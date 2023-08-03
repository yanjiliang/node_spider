#!/usr/bin/env node

const inquirer = require('inquirer');
const commander = require('commander');

const { runImg } = require('./img.handler.js');

const question = [
	{
		type: 'checkbox',
		name: 'channels',
		message: '请选择想要搜索的渠道',
		choices: [
			{
				name: '百度图片',
				value: 'images',
			},
			{
				name: '百度视频',
				value: 'videos',
			},
		],
	},
	{
		type: 'input',
		name: 'keyword',
		message: '请输入想要搜索的关键词',
	},
	{
		type: 'number',
		name: 'counts',
		message: '请输入要下载的图片张数（最小30张）',
	},
];

inquirer.prompt(question).then(result => {
	const { keyword, channels, counts } = result;

	for (let channel of channels) {
		switch (channel) {
			case 'images':
				runImg(keyword, counts);
				break;
		}
	}
});
