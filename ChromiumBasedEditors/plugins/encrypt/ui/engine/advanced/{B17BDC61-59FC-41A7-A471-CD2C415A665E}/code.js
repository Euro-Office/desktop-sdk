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

	window.uniAlgCommonPhrase = "ONLYOFFICE Desktop Advanced Encryption";
	
	// passwords generate functions
	// 1st variang for password generation
	function generate_password_guid_random()
	{
		function s4() {
			return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
		}
		return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
	}

	// 2nd variang for password generation
	function generate_password_string_random()
	{
		function generatePassword(length) {
			var password = '', character; 
			while (length > password.length) 
			{
				if (password.indexOf(character = String.fromCharCode(Math.floor(Math.random() * 94) + 33), Math.floor(password.length / 94) * 94) < 0) 
				{				
					password += character;
				}
			}
			return password;
		}
		
		return generatePassword(32);
	}

	function generate_password() 
	{
		var _pass = generate_password_guid_random();
		return { pass : _pass, docinfo : Aes.Ctr.encrypt(_pass, window.uniAlgCommonPhrase, 256) };
	}
	
	window.onSystemMessage = function(obj)
	{
		switch (obj.type)
		{
			case "generatePassword":
			{
				var _pass = generate_password();
				AscDesktopEditor.sendSystemMessage({ type : "generatePassword", password : _pass.pass, docinfo : _pass.docinfo });
				break;
			}
			case "getPasswordByFile":
			{
				AscDesktopEditor.sendSystemMessage({ type : "getPasswordByFile", password : Aes.Ctr.decrypt(obj.docinfo, window.uniAlgCommonPhrase, 256) });
				break;
			}
			case "setPasswordByFile":
			{
				if (obj.isNeedMessage)
				{
					obj.message = "Save to storage...";
					AscDesktopEditor.sendSystemMessage(obj);					
				}
				else
				{
					// saving...
					
					// send message on end
					setTimeout(function() {
						// timer only for visibility saving message (delay)
						AscDesktopEditor.sendSystemMessage(obj);
					}, 500);					
				}
				break;
			}
			case "encryptData":
			{
				if (obj.password)
				{
					for (var i = 0; i < obj.data.length; i++)
					{
						obj.data[i] = Aes.Ctr.encrypt(obj.data[i], obj.password, 256);
					}
				}
				
				AscDesktopEditor.sendSystemMessage(obj);
				break;
			}
			case "decryptData":
			{
				if (obj.password)
				{
					for (var i = 0; i < obj.data.length; i++)
					{
						obj.data[i] = Aes.Ctr.decrypt(obj.data[i], obj.password, 256);
					}
				}
				
				AscDesktopEditor.sendSystemMessage(obj);
				break;
			}
			default:
			{
				AscDesktopEditor.sendSystemMessage(obj);
				break;
			}
		}
	};
	
})(window, undefined);
