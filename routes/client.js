const express = require("express");
const Route = express.Router();

const {UsersModel, valUserCallBack} = require("../model/users.model");
const BooksModel = require("../model/books.model");

const { setLogin, logout, valAuth, formatUrl, rdr, valLoginActive, jsonRes, errHandler, validateData } = require("../helper/utilities");

const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const multer = require("multer");

// resource upload path
const resourceUploadPath = path.join(__dirname, '..', '/public/assets/uploads/resource');

/**
 * upload handlers
 */
const storage = multer.diskStorage({
    destination(req, file, cb) {
        if (!(file.originalname.match(/\.(pdf)/) || file.originalname.match(/\.(jpeg|jpg|png)/))) {
            return cb(new Error('Only pdf file, and jpeg or jpg or png thumbnail file type is valid.'));
        }
        cb(null, `${resourceUploadPath}`);
    },
    filename(req, file, cb) {
        cb(null,`${crypto.createHash('md5').update(`${Date.now()}`).digest('hex')}.${file.mimetype.split('/')[1]}`);
    },
});
const upload = multer({storage});

/**
 * landing page route
 */
Route.get('/', async (req, res) => {
    res.render('index.ejs');
});

/**
 * Login route
 */
Route.use('/login', valLoginActive, async (req, res) => {
    const urlParams = formatUrl(req.originalUrl);
    if (req.method === 'POST') {
        let notification = {msg: 'Login failed, please try again.', type: 'error'};
        try {
            const {dst = '/l/home'} = req.query;
            const {email = null, password = null} = req.body;
            const valData = await UsersModel.verifyLogin(email, password);
            if (valData) {
                if (valData.status === true) {
                    await setLogin(res, {user: valData.id});
                    return rdr(req, res, decodeURI(dst));
                }
                notification = {msg: 'Your account has been disabled for violation our terms. Contact our support team for more details.', type: 'error'}
            } else {
                notification = {msg: 'Incorrect login credentials.', type: 'error'}
            }
        } catch (error) {
            let errMsg = errHandler(error, 'Login failed, please try again.');
            notification = {msg: errMsg, type: 'error'}
        }
        return res.render(
            'login.ejs', 
            {
                notification,
                formData: req.body,
                urlParams
            }
        );
    }
    res.render('login.ejs', {urlParams});
})

/**
 * signup route
 */
Route.use('/signup', valLoginActive, async (req, res) => {
    const urlParams = formatUrl(req.originalUrl);
    if (req.method === 'POST') {
        let notification = {msg: 'Signup failed, please try again.', type: 'error'};
        try {
            const {dst = '/l/home'} = req.query;
            const {first_name = null, last_name = null, email = null, password = null} = req.body;
            const addNewUser = await UsersModel.addUser({first_name, last_name, email, password});
            if (addNewUser) {
                await setLogin(res, {user: addNewUser.id});
                return rdr(req, res, decodeURI(dst));
            }
        } catch (error) {
            let errMsg = errHandler(error, 'Signup failed, please try again.');
            notification = {msg: errMsg, type: 'error'}
        }
        return res.render(
            'signup.ejs', 
            {
                notification,
                formData: req.body,
                urlParams
            }
        );
    }
    res.render('signup.ejs', {urlParams});
});

/**
 * library home route
 */
Route.use('/l/home', valAuth, valUserCallBack, async (req, res) => {
    res.render('home.ejs', {path: '/l/home', userData: res.locals.user});
});

/**
 * libary setting route
 */
Route.use('/l/setting', valAuth, valUserCallBack, async (req, res) => {
    res.render('setting.ejs', {path: '/l/setting', userData: res.locals.user});
});

/**
 * libary resource route
 */
Route.get('/l/resource', valAuth, valUserCallBack, async (req, res) => {
    res.render('resource.ejs', {path: '/l/resource', userData: res.locals.user});
});

/**
 * libary resource uploda
 */
Route.post('/l/resource/new', valAuth, valUserCallBack, upload.any(), async (req, res) => {
    try {
        if (!req.files || req.files.length <= 0) {
            throw new Error('Pdf and thumbnail(image) files are required.');
        }
        if (!req.files[0].fieldname === 'pdf_file') {
            throw new Error('No pdf file selected.');
        }
        if (!req.files[1].fieldname === 'thumb_file') {
            throw new Error('No thumbnail(image) file selected.');
        }
        if (req.fileValidationError) {
            throw new Error(req.fileValidationError);
        }
        // thumbnail
        let pdf_file = req.files[0];
        let thumbnail = req.files[1];
        // validate ISBN & add to db
        const {ISBN = null,author = null,title = null,publisher = null,category = null,desc = null} = req.body;
        if (!ISBN || !author || !title || !publisher) {
            fs.unlink(`${pdf_file.path}`, e => {});
            fs.unlink(`${thumbnail.path}`, e => {});
            throw new Error(`Enter all required fileds.`);
        }
        if (await BooksModel.validBook({ISBN})) {
            fs.unlink(`${pdf_file.path}`, e => {});
            fs.unlink(`${thumbnail.path}`, e => {});
            throw new Error(`ISBN '${ISBN}' already exists.`);
        }
        // insert into db
        await BooksModel.addBook({
            ISBN, 
            title, 
            author, 
            publisher, 
            category, 
            desc, 
            thumbnail: thumbnail.filename, 
            pdf_file: pdf_file.filename,
        })
        res.json(jsonRes({data: 'Resource upload was successful.'}));
    } catch (error) {
        let errMsg = errHandler(error,'Resource upload failed, try again.');
        res.json(jsonRes({error: true, errorMsg: errMsg}));
    }
});

/**
 * route to fetch resources
 */
Route.get('/l/resource/fetch', valAuth, valUserCallBack, async (req, res) => {
    try {
        let {s = null, l = 50, e = null} = req.query;
        if (s && !(validateData(s, /^([\d]+)$/))) {
            throw new Error('Invalid filter parameter, refresh and try again.')
        }
        if (!(validateData(l, /^([\d]+)$/))) {
            throw new Error('Invalid filter parameter, refresh and try again.')
        }
        // define user filter
        const isUser = res.locals.user.rank !== 'admin';
        (isUser || (e && JSON.parse(e) === 1)) && (l = 20);
        const filter = isUser ? {status: true} : (e && JSON.parse(e) === 1 ? {status: true} : null );
        let resource = await BooksModel.getResources(s, (l + 1), filter);
        let more = null;
        if (resource.length > l) {
            more = resource[resource.length - 2].id;
            resource.pop();
        }
        res.json(jsonRes({data: {resource, more}}));
    } catch (error) {
        let errMsg = errHandler(error,'Resources cannot be retrieved at this time, try again later.');
        res.json(jsonRes({error: true, errorMsg: errMsg}));
    }
});

/**
 * route to search resources
 */
Route.get('/l/resource/search', valAuth, valUserCallBack, async (req, res) => {
    try {
        let { q = null, l = 50, e = null } = req.query;
        if (!q) {
            throw new Error('No search query passed in request.')
        }
        // define user filter
        const isUser = res.locals.user.rank !== 'admin';
        (isUser || (e && JSON.parse(e) === 1)) && (l = 20);
        const filter = isUser ? {status: true} : (e && JSON.parse(e) === 1 ? {status: true} : null );
        // search
        const resource = await BooksModel.searchResource(q,l,filter);
        res.json(jsonRes({data: {resource, more: null}}));
    } catch (error) {
        let errMsg = errHandler(error,'Unable to process request, try again.');
        res.json(jsonRes({error: true, errorMsg: errMsg}));
    }
});

/**
 * route to enable or disable a resouces
 */
Route.put('/l/resource/status/:id', valAuth, valUserCallBack, async (req, res) => {
    try {
        let { id } = req.params;
        const update = await BooksModel.updateResourceStatus(id);
        if (!update) {
            throw new Error('Resource update failed, try again.');
        }
        res.json(jsonRes({data: 'Resource updated.'}));
    } catch (error) {
        let errMsg = errHandler(error,'Unable to process request, try again.');
        res.json(jsonRes({error: true, errorMsg: errMsg}));
    }
});

/**
 * route to delete a resource
 */
Route.delete('/l/resource/delete/:id', valAuth, valUserCallBack, async (req, res) => {
    try {
        let { id } = req.params;
        const del = await BooksModel.deleteResource(id);
        if (!del) {
            throw new Error('Resource delete request failed, try again.');
        }
        const {thumbnail, pdf_file} = del;
        fs.unlink(`${resourceUploadPath}/${pdf_file}`, e => {});
        fs.unlink(`${resourceUploadPath}/${thumbnail}`, e => {});
        res.json(jsonRes({data: 'Resource deleted.'}));
    } catch (error) {
        let errMsg = errHandler(error,'Unable to process request, try again.');
        res.json(jsonRes({error: true, errorMsg: errMsg}));
    }
});

/**
 * route to validate resource and render pdf for reader mode
 */
Route.get('/l/resource/validate/:id', valAuth, valUserCallBack, async (req, res) => {
    try {
        let { id = null } = req. params;
        if (!id || !(validateData(id, /^([\d]+)$/))) {
            throw new Error('Invalid resource ref in request, refresh and try again.');
        }
        const validResource = await BooksModel.validBook({id,status: true});
        if (!validResource) {
            throw new Error('Resource is not available, try again later.')
        }
        validResource.pdf_file = `/assets/pdfcompiler/web/viewer.html?file=/assets/uploads/resource/${validResource.pdf_file}`;
        res.json(jsonRes({data: {title: validResource.title, id: validResource.id, pdf_file: validResource.pdf_file}}));
    } catch (error) {
        let errMsg = errHandler(error,'Resources cannot be retrieved at this time, try again later.');
        res.json(jsonRes({error: true, errorMsg: errMsg}));
    }
});

/**
 * libary users route
 */
Route.get('/l/users', valAuth, valUserCallBack, async (req, res) => {
    res.render('users.ejs', {path: '/l/users', userData: res.locals.user});
});

/**
 * route to fetch users
 */
Route.get('/l/users/fetch', valAuth, valUserCallBack, async (req, res) => {
    try {
        let {s = null, l = 50} = req.query;
        if (s && !(validateData(s, /^([\d]+)$/))) {
            throw new Error('Invalid filter parameter, refresh and try again.')
        }
        if (!(validateData(l, /^([\d]+)$/))) {
            throw new Error('Invalid filter parameter, refresh and try again.')
        }
        // get users
        let users = await UsersModel.getUsers(s, (l + 1));
        let more = null;
        if (users.length > l) {
            more = users[users.length - 2].id;
            users.pop();
        }
        res.json(jsonRes({data: {users, more}}));
    } catch (error) {
        let errMsg = errHandler(error,'Users cannot be retrieved at this time, try again later.');
        res.json(jsonRes({error: true, errorMsg: errMsg}));
    }
});

/**
 * route to search users
 */
Route.get('/l/users/search', valAuth, valUserCallBack, async (req, res) => {
    try {
        let { q = null, l = 50 } = req.query;
        if (!q) {
            throw new Error('No search query passed in request.')
        }
        // search
        const users = await UsersModel.searchUsers(q,l);
        res.json(jsonRes({data: {users, more: null}}));
    } catch (error) {
        let errMsg = errHandler(error,'Unable to process request, try again.');
        res.json(jsonRes({error: true, errorMsg: errMsg}));
    }
});

/**
 * route to enable or disable a user
 */
Route.put('/l/users/status/:id', valAuth, valUserCallBack, async (req, res) => {
    try {
        let { id } = req.params;
        if (parseInt(id) === res.locals.user.id) {
            throw new Error('Admin account status cannot be altered.');
        }
        const update = await UsersModel.updateUserStatus(id);
        if (!update) {
            throw new Error('User update failed, try again.');
        }
        res.json(jsonRes({data: 'User updated.'}));
    } catch (error) {
        let errMsg = errHandler(error,'Unable to process request, try again.');
        res.json(jsonRes({error: true, errorMsg: errMsg}));
    }
});

/**
 * route to change password
 */
Route.post('/s/password', valAuth, valUserCallBack, async (req, res) => {
    try {
        let { current_password = null, new_password = null } = req.body;
        if (!(current_password) || !(new_password)) {
            throw new Error('All fields are required.');
        }
        if (!(await UsersModel.verifyPassword(current_password, res.locals.user.password))) {
            throw new Error('Current password is incorrect.');
        }
        if (current_password === new_password) {
            throw new Error('New password must be different from current password.')
        }
        const changePassword = await UsersModel.update(
            {password: new_password},
            {where: {id: res.locals.user.id}}
        );
        if (!changePassword) {
            throw new Error('Password change failed, try again');
        }
        res.json(jsonRes({data: 'Your password has been changed.'}));
    } catch (error) {
        let errMsg = errHandler(error,'Unable to process request, try again.');
        res.json(jsonRes({error: true, errorMsg: errMsg}));
    }
});

/**
 * route to edit account
 */
Route.post('/s/account', valAuth, valUserCallBack, async (req, res) => {
    try {
        let { first_name = null, last_name = null, email = null } = req.body;
        if (!(first_name) || !(last_name) || !(email)) {
            throw new Error("All fields are required.");
        }
        const editAccount = await UsersModel.update(
            {first_name,last_name,email},
            {where: {id: res.locals.user.id}}
        );
        if (!editAccount) {
            throw new Error('Account update failed, trya again.');
        }
        res.json(jsonRes({data: 'Your account data has been updated.'}))
    } catch (error) {
        let errMsg = errHandler(error,'Unable to process request, try again.');
        res.json(jsonRes({error: true, errorMsg: errMsg}));
    }
});

/**
 * logout route
 */
Route.get('/logout', (req, res) => {
    return logout(req, res);
});

module.exports = Route;