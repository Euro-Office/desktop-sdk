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

(function(window, undefined){

	function _generatePassword()
	{
		function s4() {
			return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
		}
		return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
	}

	function _convertToHex(str) {
		var hex = '';
		for(var i=0;i<str.length;i++) {
			hex += ''+str.charCodeAt(i).toString(16);
		}
		return hex;
	}
	
	window.onSystemMessage = function(obj)
	{	
			if (!obj) return;
			
			let isConnected = ONLYONET.isConnected();
		
			switch (obj.type)
			{
				case "generatePassword":
				{
					let _pass = _generatePassword();

					if (!isConnected)
						_pass = "";

					let docinfo =  nacl.util.encodeBase64(nacl.randomBytes(nacl.box.nonceLength));
					
					AscDesktopEditor.sendSystemMessage({ type : "generatePassword", password : _pass,  docinfo : docinfo });
					
					break;					
				};
				  
				case "getPasswordByFile":  
				{
					if (!isConnected)
					{
						AscDesktopEditor.sendSystemMessage({ type : "getPasswordByFile", password : "" });
						
						break;
					}
	
					let _hashAsHex = "0x" + _convertToHex(atob(obj.hash)); 

			 		fileHash = _hashAsHex;
				
					let _pass = ONLYONET.getFilePassword(_hashAsHex);

					if (null == _pass) _pass = "";

					AscDesktopEditor.sendSystemMessage({ type : "getPasswordByFile", password : _pass });

					break;				
				}
				case "setPasswordByFile":
				{
					if (!isConnected)
					{
						AscDesktopEditor.sendSystemMessage(obj);	
						
						break;	
					}					

				 	if (obj.isNeedMessage)
					{
						obj.message = ONLYONET.Resources["system-message-save-to-blockchain"];
						AscDesktopEditor.sendSystemMessage(obj);					
					}
					else
					{
						let _hashAsHex = "0x" + _convertToHex(atob(obj.hash));

						fileHash = _hashAsHex;
	
						let _pass = encodeURIComponent(obj.password);				
				
						ONLYONET.saveFilePassword(_hashAsHex, _pass).then(result => {							
							AscDesktopEditor.sendSystemMessage(obj);
						},
						error => {							
							obj.error = error.message;
							AscDesktopEditor.sendSystemMessage(obj);
						});
					
					}
					break;
					
				}
				case "encryptData":
				{	
					if (!obj.password)
					{
						AscDesktopEditor.sendSystemMessage(obj);
						break;
					}	

					for (var i = 0; i < obj.data.length; i++)
					{
						obj.data[i] = ONLYONET.encryptData(obj.data[i], obj.password, obj.docinfo);
					}	
					
					AscDesktopEditor.sendSystemMessage(obj);

					break;
				}
				case "decryptData":
				{
					if (!obj.password)
					{
						AscDesktopEditor.sendSystemMessage(obj);
						break;
					}				

					for (var i = 0; i < obj.data.length; i++)
					{
						if (obj.data[i]["change"])
						{
							obj.data[i]["change"] = ONLYONET.decryptData(obj.data[i]["change"], obj.password, obj.docinfo );
						}
						else
						{
							obj.data[i] = ONLYONET.decryptData(obj.data[i], obj.password, obj.docinfo);
						}
					}	
					
					AscDesktopEditor.sendSystemMessage(obj);

					break;
				}
				case "user":
				{
					obj.account = {};
					obj.account.address = ONLYONET.getAddress();
					obj.account.publicKey = ONLYONET.getPublicKey();	
					
					AscDesktopEditor.sendSystemMessage(obj);

					break;
				}
				case "share":
				{					
					let _hashAsHex = "0x" + _convertToHex(atob(obj.hash));

					let _pass = ONLYONET.getFilePassword(_hashAsHex);
					
					if (_pass != "") {

						let _accounts = [];

						let _addresses = obj.accounts.addresses;

						if (!_addresses)
						_addresses = obj.accounts;

						$.each(_addresses, function(index, account) {
							if (!ONLYONET.isFilePasswordExist(_hashAsHex, account.address)) 
							{
								_accounts.push(account);
							}
						});


						ONLYONET.saveFilePassword(_hashAsHex, _pass, _accounts).then(result => {								
								obj.result = "OK";
								AscDesktopEditor.sendSystemMessage(obj);
							},
							error => {
								obj.result = JSON.stringify(error);
								AscDesktopEditor.sendSystemMessage(obj);
							}						 
						);
					}
					else {						
						obj.result = "[Error]: Could not get password";
						AscDesktopEditor.sendSystemMessage(obj);
					}

					break;
				}
				default:
					break;
			}		
	};
	
	window.onChangeEditorsCount = function(isEditorsPresent)
	{
		ONLYONET.UI.isEditorsPresent = isEditorsPresent;
	};

})(window, undefined);