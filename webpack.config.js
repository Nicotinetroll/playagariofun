const path = require('path');

module.exports = function(isProduction) {
    return {
        entry: './src/client/js/app.js',
        mode: isProduction ? 'production' : 'development',
        output: {
            filename: 'app.js',
            path: path.resolve(__dirname, 'bin/client/js')
        },
        target: 'web',
        module: {
            rules: [
                {
                    test: /\.js$/,
                    exclude: /node_modules/,
                    use: {
                        loader: 'babel-loader',
                        options: {
                            presets: ['@babel/preset-env']
                        }
                    }
                }
            ]
        },
        resolve: {
            fallback: {
                "buffer": false,
                "crypto": false,
                "stream": false,
                "path": false,
                "fs": false,
                "util": false
            }
        }
    };
};
