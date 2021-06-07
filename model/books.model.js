const DbInstance = require("../DB/db_connection");
const { DataTypes, QueryTypes } = require("sequelize");

const BooksModel = DbInstance.define(
    "books",
    {
        id: {
			type: DataTypes.INTEGER,
			primaryKey: true,
			autoIncrement: true,
        },
        ISBN: {
            type: DataTypes.STRING,
            unique: true,
            allowNull: false,
        },
        title: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        author: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        publisher: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        category: {
            type: DataTypes.STRING,
        },
        desc: {
            type: DataTypes.TEXT,
        },
        cost: {
            type: DataTypes.STRING,
            defaultValue: '0',
        },
        thumbnail: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        pdf_file: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        status: {
			type: DataTypes.BOOLEAN,
			defaultValue: true,
		}
    }
);

BooksModel.validBook = async (target) => {
    let validBook = await BooksModel.findOne({where: target});
    return validBook ? validBook : null;
}

BooksModel.addBook = async ({ISBN, title, author, publisher, category, desc, thumbnail, pdf_file}) => {
    if (
        await BooksModel.create({
            ISBN,
            title,
            author,
            publisher,
            category,
            desc,
            thumbnail,
            pdf_file,
        })
    ) {
        return await BooksModel.findOne({where: {ISBN}, order: [['id', 'DESC']]});
    }
    return null;
}

BooksModel.getResources = async (start, limit, filter = null) => {
    // set filter
    let setTarget = start ? ` WHERE id < ${start} ` : ` `;
    setTarget += (filter ? (start ? ` AND ` : ` WHERE `)+Object.keys(filter).map(e => `${e}=${filter[e]}`).join(' AND ')+` ` : ``);
    // run query
	return await DbInstance.query(
		`SELECT * FROM books${setTarget}ORDER BY id DESC LIMIT ${limit}`,
		{
			type: QueryTypes.SELECT,
		}
	);
};

BooksModel.searchResource = async (query, limit, filter = null) => {
    // set filter
    let setFilter = filter ? ` AND ${Object.keys(filter).map(e => `${e}=${filter[e]}`).join(' AND ')} ` : ` `;
    return await DbInstance.query(
		`SELECT * FROM books WHERE (ISBN LIKE :qry OR title LIKE :qry OR author LIKE :qry)${setFilter}ORDER BY id DESC LIMIT ${limit}`,
		{
            replacements: {qry: `%${query}%`},
			type: QueryTypes.SELECT,
		}
	);
}

BooksModel.updateResourceStatus = async (id) => {
    const validResource = await BooksModel.validBook({id});
    if (!validResource) {
        throw new Error('Resource not found.');
    }
    return await BooksModel.update(
        {status: !validResource.status},
        {where: {id}}
    );
}

BooksModel.deleteResource = async (id) => {
    const validId = await BooksModel.validBook({id});
    if (!validId) {
        throw new Error('Resource not found.');
    }
    return await BooksModel.destroy({where: {id}}) ? validId : null;
}

BooksModel.sync({force: false})
    .then(() => {})
    .catch(e => console.log(`Books Model Error: `, e));

module.exports = BooksModel;