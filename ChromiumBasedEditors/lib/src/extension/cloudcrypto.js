/*
 * Copyright (C) Ascensio System SIA, 2009-2026
 *
 * This program is a free software product. You can redistribute it and/or
 * modify it under the terms of the GNU Affero General Public License (AGPL)
 * version 3 as published by the Free Software Foundation, together with the
 * additional terms provided in the LICENSE file.
 *
 * This program is distributed WITHOUT ANY WARRANTY; without even the implied
 * warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. For
 * details, see the GNU AGPL at: https://www.gnu.org/licenses/agpl-3.0.html
 *
 * You can contact Ascensio System SIA by email at info@onlyoffice.com
 * or by postal mail at 20A-6 Ernesta Birznieka-Upisha Street, Riga,
 * LV-1050, Latvia, European Union.
 *
 * The interactive user interfaces in modified versions of the Program
 * are required to display Appropriate Legal Notices in accordance with
 * Section 5 of the GNU AGPL version 3.
 *
 * No trademark rights are granted under this License.
 *
 * All non-code elements of the Product, including illustrations,
 * icon sets, and technical writing content, are licensed under the
 * Creative Commons Attribution-ShareAlike 4.0 International License:
 * https://creativecommons.org/licenses/by-sa/4.0/legalcode
 *
 * This license applies only to such non-code elements and does not
 * modify or replace the licensing terms applicable to the Program's
 * source code, which remains licensed under the GNU Affero General
 * Public License v3.
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

window.AscDesktopEditor.cloudCryptoCommandMainFrame = function(obj, callback){
	window.cloudCryptoCommandMainFrame_callback = callback;
	window.AscDesktopEditor._cloudCryptoCommandMainFrame(window.AscDesktopEditor.GetFrameId(), JSON.stringify(obj));
};
window.AscDesktopEditor.cloudCryptoCommand = function(type, param, callback)
{
	window.AscDesktopEditor.initCryptoWorker(param.cryptoEngineId);
	window.cloudCryptoCommandCounter = 0;
	window.cloudCryptoCommandCount = 0;
	window.cloudCryptoCommandParam = param;
	window.cloudCryptoCommandCallback = callback;
	switch (type)
	{
		case "share":
		{
			var filesInput = Array.isArray(param.file) ? param.file : [param.file];
			window.cloudCryptoCommandCount = filesInput.length;
			window.AscDesktopEditor.DownloadFiles(filesInput, [], function(files) {				
				
				for (var fileItem in files)
				{
					let file = files[fileItem];
					let isSupportCrypt = window.AscDesktopEditor.isFileSupportCloudCrypt(file, true);
					let isCrypto = false;

					if (isSupportCrypt)
					{
						let docinfo = window.AscDesktopEditor.getDocumentInfo(file);
						let param = window.cloudCryptoCommandParam;					
						if (docinfo == "")
						{
							let password = window.AscCrypto.CryptoWorker.createPassword();
							docinfo = window.AscCrypto.CryptoWorker.generateDocInfo(param.keys, password);
							isCrypto = window.AscDesktopEditor.setDocumentInfo(file, password, docinfo);
						}
						else
						{
							let password = window.AscCrypto.CryptoWorker.readPassword(docinfo);						
							docinfo = window.AscCrypto.CryptoWorker.generateDocInfo(param.keys, password);						
							isCrypto = window.AscDesktopEditor.setDocumentInfo(file, password, docinfo);						
						}
					}

					window.AscDesktopEditor.loadLocalFile(file, function(data){
						window.cloudCryptoCommandCallback({
							bytes : data,
							isCrypto : isCrypto,
							url : fileItem
						});
						
						window.AscDesktopEditor.RemoveFile(file);

						window.cloudCryptoCommandCounter++;
						if (window.cloudCryptoCommandCounter == window.cloudCryptoCommandCount)
						{
							window.cloudCryptoCommandCount = 0;
							delete window.cloudCryptoCommandParam;
							delete window.cloudCryptoCommandCallback;
						}
					});
				}
				
			}, 1);
			
			break;
		}
		case "upload":
		{
			var filter = param.filter || "any";
			var keys = param.keys || [];
			var user = window.AscCrypto.CryptoWorker.User;
			keys.push({ userId : user[2], publicKey : user[1] });
			window.AscDesktopEditor.OpenFilenameDialog(filter, true, function(files) {
				if (!Array.isArray(files))
					files = [files];

				window.cloudCryptoCommandCount = files.length;
				for (var i = 0; i < files.length; i++)
				{
					let file = files[i];
					let isSupportCrypt = window.AscDesktopEditor.isFileSupportCloudCrypt(file);
					let isOfficeFileCrypt = window.AscDesktopEditor.isFileCrypt(file);
					let cryptoFile = "";

					if (isSupportCrypt && !isOfficeFileCrypt)
					{
						let password = window.AscCrypto.CryptoWorker.createPassword();						
						docinfo = window.AscCrypto.CryptoWorker.generateDocInfo(keys, password);
						cryptoFile = window.AscDesktopEditor.setDocumentInfo(file, password, docinfo, true);
					}
					let isCrypto = ("" != cryptoFile) ? true : false;
					let curIndex = i;
					window.AscDesktopEditor.loadLocalFile(isCrypto ? cryptoFile : file, function(data){
						
						var fileName = file;
						var index = fileName.lastIndexOf("/");
						if (index != -1) fileName = fileName.substring(index + 1);
						index = fileName.lastIndexOf("\\");
						if (index != -1) fileName = fileName.substring(index + 1);

						window.cloudCryptoCommandCallback({
							bytes : data,
							isCrypto : isCrypto,
							name : fileName,
							index : curIndex,
							count : window.cloudCryptoCommandCount
						});

						if (isCrypto)
							window.AscDesktopEditor.RemoveFile(cryptoFile);
						
						window.cloudCryptoCommandCounter++;
						if (window.cloudCryptoCommandCounter == window.cloudCryptoCommandCount)
						{
							window.cloudCryptoCommandCount = 0;
							delete window.cloudCryptoCommandParam;
							delete window.cloudCryptoCommandCallback;
						}
					});
				}
			});
			break;
		}
		default:
		{
			callback(null);
			delete window.cloudCryptoCommandParam;
			delete window.cloudCryptoCommandCallback;
			break;
		}
	}
};
