const DbInstance = require("../DB/db_connection");
const { DataTypes, QueryTypes } = require("sequelize");
const bcryptjs = require("bcryptjs");
const { formatUrl, logout } = require("../helper/utilities");

const UsersModel = DbInstance.define(
    "users",
    {
        id: {
			type: DataTypes.INTEGER,
			primaryKey: true,
			autoIncrement: true,
        },
        first_name: {
			type: DataTypes.STRING,
			allowNull: false,
			validate: {
				function(value) {
					if (!(/^([a-zA-Z\s]+)([-]?)([a-zA-Z\s]+)$/.test(value))) {
						throw new Error("Special characters are not allowed as first name.");
                    }
				},
			},
		},
		last_name: {
			type: DataTypes.STRING,
			allowNull: false,
			validate: {
				function(value) {
					if (!(/^([a-zA-Z\s]+)([-]?)([a-zA-Z\s]+)$/.test(value))) {
						throw new Error("Special characters are not allowed as last name.");
                    }
				},
			},
		},
        email: {
			type: DataTypes.STRING,
			unique: true,
			validate: {
				isEmail: {
					args: true,
					msg: "Please enter a valid email to proceed.",
				},
			},
		},
        password: {
			type: DataTypes.STRING,
            allowNull: false,
			validate: {
				function(value) {
					if (!(/^[A-Za-z\d@$!%*#?&]{6,20}$/.test(value))) {
						throw new Error("Password can only contain 6-20 letters, digits and $!%*#?&.");
                    }
				},
			},
        },
        rank: {
            type: DataTypes.STRING,
            defaultValue: 'user',
        },
        status: {
			type: DataTypes.BOOLEAN,
			defaultValue: true,
		}
    },
    {
        hooks: {
            afterValidate: async (accountInstance) => {
                try {
                    let {password = ''} = accountInstance;
                    let salt = await bcryptjs.genSalt(12);
                    accountInstance.password = await bcryptjs.hash(password, salt);
                } catch (error) {
                    console.log(`Password Hash: `, error);
                }
            }
        }
    }
);

UsersModel.validUser = async (user) => {
    let validUser = await UsersModel.findOne({where: user});
    return validUser ? validUser : null;
}

UsersModel.addUser = async ({first_name, last_name, email, password}) => {
    if (
        await UsersModel.create({
            first_name: first_name.toString().toLowerCase(),
            last_name: last_name.toString().toLowerCase(),
            email: email.toString().toLowerCase(),
            password
        })
    ) {
        return await UsersModel.findOne({where: {email}, order: [['id', 'DESC']]});
    }
    return null;
}

UsersModel.verifyPassword = (password, user_password) => {
    return bcryptjs.compareSync(password, user_password);
}

UsersModel.verifyLogin = async (email, password) => {
    let user = await UsersModel.validUser({email});
    if (!user) {
        throw new Error('Email address does not match any account.');
    }
    return await UsersModel.verifyPassword(password, user.password) ? user : null;
};

UsersModel.getUsers = async (start, limit, filter = null) => {
    // set filter
    let setTarget = start ? ` WHERE id < ${start} ` : ` `;
    setTarget += (filter ? (start ? ` AND ` : ` WHERE `)+Object.keys(filter).map(e => `${e}=${filter[e]}`).join(' AND ')+` ` : ``);
    // run query
	return await DbInstance.query(
		`SELECT * FROM users${setTarget}ORDER BY id DESC LIMIT ${limit}`,
		{
			type: QueryTypes.SELECT,
		}
	);
};

UsersModel.searchUsers = async (query, limit, filter = null) => {
    // set filter
    let setFilter = filter ? ` AND ${Object.keys(filter).map(e => `${e}=${filter[e]}`).join(' AND ')} ` : ` `;
    return await DbInstance.query(
		`SELECT * FROM users WHERE (first_name LIKE :qry OR last_name LIKE :qry OR email LIKE :qry)${setFilter}ORDER BY id DESC LIMIT ${limit}`,
		{
            replacements: {qry: `%${query}%`},
			type: QueryTypes.SELECT,
		}
	);
}

UsersModel.updateUserStatus = async (id) => {
    const validUser = await UsersModel.validUser({id});
    if (!validUser) {
        throw new Error('User not found.');
    }
    return await UsersModel.update(
        {status: !validUser.status},
        {where: {id}}
    );
}

const adminRoutes = [
    /^(\/l\/resource)$/,
    /^(\/l\/resource\/status\/(\d+))$/,
    /^(\/l\/resource\/new)$/,
    /^(\/l\/users)$/,
    /^(\/l\/users\/fetch)$/,
    /^(\/l\/users\/search)$/,
    /^(\/l\/users\/status\/(\d+))$/,
];

const valUserCallBack = async (req, res, next) => {
    const isAdminPath = adminRoutes.filter(e => e.test(req.originalUrl.split(/\?/)[0]));
    const userData = await UsersModel.validUser({id: res.locals.user});
	const {status = false, rank = 'user'} = userData;
	if (!status) {
        let formattedUrl = formatUrl(req.originalUrl, req.originalUrl.split(/\?/)[0]);
		return logout(req, res, `/login${formattedUrl}`);
	}
    if (isAdminPath.length > 0 && (rank !== 'admin')) {
		return logout(req, res, `/login`);
    }
	res.locals.user = userData.dataValues;
	next();
}

UsersModel.sync({force: false})
    .then(() => {})
    .catch(e => console.log(`Users Model Error: `, e));

module.exports = {
    UsersModel,
    valUserCallBack
};