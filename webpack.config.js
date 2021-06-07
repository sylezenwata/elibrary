const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const OptimizeCssAssetsPlugin = require("optimize-css-assets-webpack-plugin");
const UglifyJsPlugin = require("uglifyjs-webpack-plugin");

module.exports = {
	entry: {
        login: '/public/assets/js/sub/login.js',
        home: '/public/assets/js/sub/l/home.js',
        setting: '/public/assets/js/sub/l/setting.js',
        users: '/public/assets/js/sub/l/users.js',
        resource: '/public/assets/js/sub/l/resource.js',
    },
	mode: "production",
	output: {
		path: `${__dirname}/public/static`,
		filename: "[contenthash].js",
		environment: {
			arrowFunction: false
		}
	},
	plugins: [
		new MiniCssExtractPlugin({
			filename: '[contenthash].css',
		})
	],
	module: {
		rules: [
			{
				test: /\.css$/,
				use: [MiniCssExtractPlugin.loader, "css-loader"],
			},
			{
				test: /\.(svg|gif|png|eot|woff|ttf)$/,
				use: ["url-loader"],
			},
            {
                test: /\.js$/,
                exclude: /(node_modules|bower_components)/,
                use: {
                    loader: 'babel-loader',
                    options: {
                        presets: ['@babel/preset-env'],
                    },
                },
            },
		],
	},
	optimization: {
		splitChunks: {
			chunks: 'all',
		},
		minimize: true,
		minimizer: [
			// new TerserPlugin({
			// 	extractComments: false,
			// }),
			new UglifyJsPlugin({
				test: /\.js(\?.*)?$/i,
				sourceMap: true,
                extractComments: true,
			}),
			new OptimizeCssAssetsPlugin(),
		],
	},
};