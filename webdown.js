var fs = require('fs');
var path = require('path');
var request = require('request');
var cheerio = require('cheerio');
var iconv = require('iconv-lite');
// 基本配置项
var optionsBase = {
    name: 'demo', // 项目目录
    baseUrl: 'http://www.qq.com/', // 网站主地址
    ignore: ['cnzz', 'tongji', 'jiathis', 'tools'], // 忽略地址的关键词
    conLogo: 'img1.gtimg.com', // 内容图片的标识
    cssLogo: 'mat1.', // css图片的标识，慎用，只会下载包含此标识的css图片
    pageName: 'demo', // 页面的名称
};

// request请求配置
var options = {
    url: 'http://www.qq.com/', //要下载的网址
    headers: {
        'User-Agent': 'request'
    },
    encoding: null
};

function callback(error, response, body) {
    if (!error && response.statusCode == 200) {
        // 创建目录
        mkBaseDir();
        // 同时数据处理
        acquireData(body);
    }
}

request(options, callback);

// 处理数据
function acquireData(data) {
    // console.log(data);
    var $ = cheerio.load(data, {
        decodeEntities: false
    });
    optionsBase.encoding = $('mate[http-equiv="Content-Type"]').attr('content').indexOf('utf') == -1 ? 'gbk' : 'utf8';
    
    if (optionsBase.encoding == 'gbk') data = iconv.decode(data, 'gbk');

    $('link[rel="stylesheet"]').each(function(i, el) {
        var $source = $(el).attr('href');
        download($source);
        $(el).attr('href', 'css/' + path.basename($source));
    });

    $('script[src]').each(function(i, el) {
        var $source = $(el).attr('src'),
            isRequireFile = true;

        optionsBase.ignore.forEach(function(e, i) {
            if ($source.indexOf(e) != -1) {
                $(el).remove();
                isRequireFile = false;
            }
        })
        if (isRequireFile) {
            download($source);
            $(el).attr('src', 'js/' + path.basename($source));
        }
    });
    $('img').each(function(i, el) {
        var $source = $(el).attr('src');
        if (!$source) return;
        isRequireFile = true;
        optionsBase.ignore.forEach(function(e, i) {
            if ($source.indexOf(e) != -1) isRequireFile = false;
        })
        if (!isRequireFile) return;
        if ($source.indexOf(optionsBase.conLogo) != -1) {
            download($source, 1);
            $(el).attr('src', 'pic/' + path.basename($source));
        } else {
            download($source);
            $(el).attr('src', 'images/' + path.basename($source));
        }
    });
    // 去掉内容里的链接
    $('a').each(function(i, el) {
        var href = $(el).attr('href');
        if (href && href.indexOf('java') == -1) {
            $(el).attr('href', '###');
        }
    });
    // 解析内联css
    var inlineCss;
    $('style').each(function(i, el) {
        inlineCss += $(el).html();
    });
    parseCss(inlineCss, optionsBase.baseUrl, function(aacss) {
        
    });
    // 兼容st编辑器，多个中线注释会出错
    var fileData = $.html().replace(/<!--/g, '<!-- ').replace(/-->/g, ' -->'),
    filePath = optionsBase.name + '/' + optionsBase.pageName + '.html';

    if (optionsBase.encoding == 'gbk') fileData = iconv.encode(fileData, 'gbk');
    // 创建html文件
    fs.writeFile(filePath, fileData, function(err) {
        if (err) {
            console.log('1:' + err);
        } else {
            console.log(optionsBase.pageName + '.html created');
        };
    })

}

function mkBaseDir() {
    aFolder = ['css', 'js', 'pic', 'images'];

    aFolder.forEach(function(e, i) {
        mkdir(optionsBase.name + '/' + e);
        console.log('Dir '+ optionsBase.name + '/' + e + ' created');
    })
}

/**
 * 下载文件
 * @param  {string}   uri      请求的url
 * @param  {string}   dirName  保存的路径
 * @param  {Function} callback [description]
 * @return {[type]}            [description]
 */
function download(uri, isCon, callback) {
    return;
    if (uri.indexOf('http') == -1) {
        uri = (uri.indexOf('/') == 0 ? optionsBase.baseUrl : options.url) + uri;
    }

    var dirName = optionsBase.name + '/',
        extname = path.extname(uri.split('?')[0]);

    if (/.(?:png|jpg|jpeg|bmp|gif)/.test(extname)) {
        dirName += isCon ? 'pic' : 'images';
    } else if (/.(?:css|js)/.test(extname)) {
        dirName += extname.replace('.', '');
    }

    request.head(uri, function(err, res, body) {
        // console.log('content-type:', res.headers['content-type'].charset);  //这里返回图片的类型
        // console.log('content-length:', res.headers['content-length']);  //图片大小
        if (err) {
            console.log('2:' + err + ':' + uri);
            return false;
        }
        var fileName = path.basename(uri).split('?')[0];
        request(uri, function(error, response, bodycss) {
            if (extname == '.css' && !error && response.statusCode == 200) {
                parseCss(bodycss, uri, function(convertCss) {
                    
                });
            } else if (error) {
                console.log('3:' + err + ':' + uri);
            }
        })
        .pipe(fs.createWriteStream(dirName + '/' + fileName))
        .on('close', function() {
            console.log('file '+ dirName + '/' + fileName + ' created');
        });
    });
};
/**
 * 解析css源码并提取附件
 * @param  {stream} data    css流
 * @param  {string} baseUrl css文件地址
 * @return {null}         
 */
function parseCss(data, baseUrl, callback) {
    var urlsRegexp = /\(([^)]*)\)/ig,
    aImgUrls = data.match(urlsRegexp),
    sImgUrls = 'aaa';

    aImgUrls && aImgUrls.forEach(function(e, i) {
        if (e.indexOf(',') == -1 && sImgUrls.indexOf(e) == -1 && e.indexOf(optionsBase.cssLogo) != -1) {
            var uri1 = e = e.replace(/\(('|"|)|('|"|)\)/g, '');
            sImgUrls += '|' + e;

            // return;
            // console.log(path.dirname(uri).replace('css', '') + e.replace('../', ''));
            if (e.indexOf('http') == -1) {
                uri1 = path.dirname(baseUrl).replace('css', '') + e.replace('../', '');
            }

            request(uri1, function(err, res, body) {
                if (err) {
                    console.log('4:' + err + ':' + uri1);
                }
            })
            .pipe(fs.createWriteStream(optionsBase.name + '/images/' + path.basename(e)))
            .on('close', function() {
                console.log('file css images '+ path.basename(e) + ' created');
            });
            callback.call(this, data);
        }
    })
}
/**
 * 创建文件目录
 * @param  {[type]} dirpath [description]
 * @param  {[type]} dirname [description]
 * @return {[type]}         [description]
 */
function mkdir(dirpath, dirname) {
    //判断是否是第一次调用  
    if (typeof dirname === "undefined") {
        if (fs.existsSync(dirpath)) {
            return;
        } else {
            mkdir(dirpath, path.dirname(dirpath));
        }
    } else {
        //判断第二个参数是否正常，避免调用时传入错误参数  
        if (dirname !== path.dirname(dirpath)) {
            mkdir(dirpath);
            return;
        }
        if (fs.existsSync(dirname)) {
            fs.mkdirSync(dirpath)
        } else {
            mkdir(dirname, path.dirname(dirname));
            fs.mkdirSync(dirpath);
        }
    }
}