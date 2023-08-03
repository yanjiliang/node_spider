const superagent = require('superagent');
const cheerio = require('cheerio');
const path = require('path');
const fs = require('fs');
const cliProgress = require('cli-progress');

const bar = new cliProgress.SingleBar(
	{
		clearOnComplete: false,
	},
	cliProgress.Presets.shades_classic
);

let total = 0;
let finished = 0;

const header = {
	Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
	'Accept-Encoding': 'gzip, deflate, br',
	Accept2: 'text/plain, */*; q=0.01',
	'Accept-Language': 'zh-CN,zh;q=0.9',
	'Cache-Control': 'max-age=0',
	Connection: 'keep-alive',
	'User-Agent':
		'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/103.0.0.0 Safari/537.36',
	'sec-ch-ua': '".Not/A)Brand";v="99", "Google Chrome";v="103", "Chromium";v="103"',
};

function getValueListByReg(str, key) {
	const reg = new RegExp(`"${key}":"(.*?)"`, 'g');
	const matchResult = str.match(reg);

	const resultList = matchResult.map(item => {
		const result = item.match(/:"(.*?)"/g);
		return RegExp.$1;
	});

	return resultList;
}

function mkImageDir(pathname) {
	return new Promise((resolve, reject) => {
		const fullPath = path.resolve(__dirname, pathname);

		if (fs.existsSync(fullPath)) {
			removeDir(pathname);
		}

		fs.mkdirSync(fullPath);
		console.log(`目录创建成功！目录为：${pathname}`);
		return resolve();
	});
}

function removeDir(pathname) {
	const fullPath = path.resolve(__dirname, pathname);
	console.log(`${pathname}目录已存在，准备执行删除`);

	fs.rmdirSync(fullPath, {
		force: true,
		recursive: true,
	});
	console.log(`目录${pathname}已删除！`);

	// const process = require('child_process');
	// process.execSync(`rm -rf ${fullPath}`);
}

function downloadImage(url, name, index) {
	return new Promise((resolve, reject) => {
		const fullPath = path.join(
			__dirname,
			'images',
			`${index + 1}.${name.replace('?', '').replace('|', '')}.png`
		);

		if (fs.existsSync(fullPath)) {
			return reject(`图片已存在，${fullPath}`);
		}

		superagent.get(url).end((err, res) => {
			if (err) {
				return reject(err, `获取链接出错，内容为：${res}`);
			}

			if (JSON.stringify(res.body) === '{}') {
				return resolve(`第${index + 1}图片内容为空`);
			}

			fs.writeFile(fullPath, res.body, 'binary', err => {
				if (err) {
					return reject(`第${index + 1}张图片下载失败: ${err}`);
				}
				return resolve(`第${index + 1}张图片下载成功: ${url}`);
			});
		});
	});
}

function request(url, acceptKey = 'Accept') {
	return new Promise((resolve, reject) => {
		superagent
			.get(url)
			.set('Accept', header[acceptKey])
			.set('Accept-Encoding', header['Accept-Encoding'])
			.set('Accept-Language', header['Accept-Language'])
			.set('Cache-Control', header['Cache-Control'])
			.set('Connection', header['Connection'])
			.set('User-Agent', header['User-Agent'])
			.end(async (err, res) => {
				if (err) {
					reject('访问失败，原因: ', err);
					return;
				}

				resolve(res);
			});
	});
}

async function getImageByPage(start, total, word) {
	let allImages = [];

	while (start < total) {
		const size = Math.min(60, total - start);
		const res = await request(
			`https://image.baidu.com/search/acjson?tn=resultjson_com&word=${encodeURIComponent(
				word
			)}&queryWord=${encodeURIComponent(
				word
			)}&ie=utf-8&oe=utf-8&pn=${start}&rm=${size}&${Date.now()}=`,
			'Accept2'
		);

		allImages = allImages.concat(JSON.parse(res.text).data);
		start += size;
	}

	return allImages;
}

function runImg(keyword, counts) {
	request(
		`http://image.baidu.com/search/index?tn=baiduimage&ie=utf-8&word=${encodeURIComponent(
			keyword
		)}`
	).then(async res => {
		const htmlText = res.text;

		const imageUrlList = getValueListByReg(htmlText, 'objURL');
		const titleList = getValueListByReg(htmlText, 'fromPageTitle').map(item =>
			item.replace('<strong>', '').replace('<\\/strong>', '')
		);

		let allImageUrls = imageUrlList.map((imageUrl, index) => {
			return {
				imageUrl,
				title: titleList[index],
			};
		});

		const firstPageCount = allImageUrls.length;

		if (counts > firstPageCount) {
			const restImgUrls = await getImageByPage(firstPageCount, counts, keyword);
			const formatImgUrls = restImgUrls
				.filter(item => item.middleURL)
				.map(item => {
					return {
						imageUrl: item.middleURL,
						title: item.fromPageTitle.replace('<strong>', '').replace('</strong>', ''),
					};
				});

			allImageUrls = allImageUrls.concat(formatImgUrls);
		}

		total = allImageUrls.length;

		try {
			await mkImageDir('images');
			bar.start(total, 0);

			allImageUrls.forEach((item, index) => {
				downloadImage(item.imageUrl, allImageUrls[index].title, index)
					.then(() => {
						finished++;
						bar.update(finished);
					})
					.then(() => {
						if (finished === total) {
							bar.stop();
							console.log('恭喜，图片下载完成！');
						}
					});
			});
		} catch (e) {
			console.log(e);
		}
	});
}

module.exports = {
	runImg,
};
