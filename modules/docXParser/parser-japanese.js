(function(module) {

	'use strict';
		
	const _ = require('lodash');
	const fs = require('fs');
	const path = require('path')
	const utils = require('./utils.js')
	const enParser = require('./parser-english.js');
	const xml2js = require('xml2js');
	const parser = new xml2js.Parser({
		explicitArray: false
	});
	
	module.parse = (xmlObj, filePath, callback) => {
		let file, englishXML, htmlDocument, jpFileNameExpression, englishFileExists;
		
		htmlDocument = utils.createHtmlDocument();
		
		jpFileNameExpression = /.ja-JP/;
		
		file = {
			en: {
				fileName: path.basename(filePath).replace(jpFileNameExpression, ''),
				fullPath: filePath.replace(jpFileNameExpression, '')
			},
			jp: {
				fileName: path.basename(filePath),
				fullPath: filePath
			}
		};
		
		englishFileExists = fs.existsSync(file.en.fullPath);
		
		if(englishFileExists) {
			englishXML = fs.readFileSync(file.en.fullPath, 'utf8');
			
			parser.parseString(englishXML, (error, obj) => {
				
				if(error){
					callback(error, {});
				} else {
					enParser.parse(obj, filePath, (parseError, englishHtmlDocument) => {
						
						if(parseError){
							callback(parseError, {});
						} else {							
							htmlDocument = englishHtmlDocument;
							
							let jpXML = fs.readFileSync(file.jp.fullPath, 'utf8');
							
							parser.parseString(jpXML, (jpParseError, jpObj) => {
								
								if(jpParseError){
									callback(jpParseError, {});
								} else {
									if(!_.isUndefined(jpObj.topic.title) && !_.isUndefined(jpObj.topic.title._)){
										htmlDocument.title = jpObj.topic.title._.trim();
									}
									
									if(!_.isUndefined(jpObj.topic.topicsection)){
										htmlDocument.markup = jpObj.topic.topicsection._;
									}
									
									callback(null, htmlDocument);
								}
							});
						}
					});
				}
			});
		} else {
			let error = {
				message: 'Japanese topic does not have an English counterpart',
				filePath: file.jp.fullPath,
				tag: 'parse'
			};
			callback(error, null);
		}
	};
}(module.exports));