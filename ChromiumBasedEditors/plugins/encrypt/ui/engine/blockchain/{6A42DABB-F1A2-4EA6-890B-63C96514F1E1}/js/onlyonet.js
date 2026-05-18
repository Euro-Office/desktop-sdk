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

if (typeof ONLYONET === "undefined") {
    ONLYONET = {};
}

ONLYONET = (function() {


return {    
    generateRandomEnrollmentId: function() {
		function s4() {
			return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
		}

        let guid = s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
        
        return `${guid}@rca.onlyoffice.dev`;
    },    
    getBlockchainInfo: function () { 
        return $.ajax({
            method: "POST",
            url: ONLYONET.AppSettings.client_endpoint + "/system/blockchaininfo",
            contentType: "application/json",
            async: true,
            dataType: 'json',
            data: JSON.stringify({"enrollmentID": ONLYONET.AppSettings.CurrentUser.enrollmentID })
        });  
    },
    encryptData: function (data, key, nonce) {     
        var messageUInt8Array = nacl.util.decodeUTF8(data);
        var nonceUInt8Array = nacl.util.decodeBase64(nonce);
        var keyUInt8Array = nacl.util.decodeUTF8(key.replace(/-/g,''));
      
        return nacl.util.encodeBase64(nacl.secretbox(messageUInt8Array, nonceUInt8Array, keyUInt8Array));        
    },  
    decryptData: function (data, key, nonce) {
        var messageUInt8Array = nacl.util.decodeBase64(data);
        var keyUInt8Array = nacl.util.decodeUTF8(key.replace(/-/g,''));
        var nonceUInt8Array = nacl.util.decodeBase64(nonce);

        return nacl.util.encodeUTF8(nacl.secretbox.open(messageUInt8Array, nonceUInt8Array, keyUInt8Array));    
    },
    registerAndEnrollUser:  async function(enrollmentID, enrollmentSecret) {       
        const userInfo = await $.ajax({
                                    method: "POST",
                                    url: ONLYONET.AppSettings.server_endpoint + "/user/enroll",
                                    contentType: "application/json",                                    
                                    dataType: 'json',
                                    data: JSON.stringify({"enrollmentID": enrollmentID, 
                                                          "enrollmentSecret": enrollmentSecret})
                                }); 

        await $.ajax({
                        method: "POST",
                        url: ONLYONET.AppSettings.client_endpoint + "/user/wallet",
                        contentType: "application/json",   
                        data: JSON.stringify({"enrollmentID": enrollmentID, 
                                            "mspId": userInfo.mspId,
                                            "publicKeyECDSA": userInfo.publicKeyECDSA,
                                            "privateKeyECDSA": userInfo.privateKeyECDSA
                                            })
                    });
      
        const ECIES = await $.ajax({
                                    method: "POST",
                                    url: ONLYONET.AppSettings.client_endpoint + "/user/eccrypto/generate",
                                    contentType: "application/json", 
                                    dataType: 'json',           
                                    data: JSON.stringify({"enrollmentID": enrollmentID})
                                });
                                
        return JSON.stringify({
            enrollmentID: userInfo.enrollmentID,
            enrollmentSecret: userInfo.enrollmentSecret,
            mspId: userInfo.mspId,            
            publicKeyECDSA: userInfo.publicKeyECDSA,
            privateKeyECDSA: userInfo.privateKeyECDSA,
            publicKeyECIES: ECIES.publicKeyECIES,
            privateKeyECIES: ECIES.privateKeyECIES 
        });
        
    },
    saveFilePassword: function (fileHash, filePassword, accounts) {  
        let promises = [];
          
        if (accounts == null)
        {
            accounts = [ { "address": "", "publicKey": ONLYONET.AppSettings.CurrentUser.publicKeyECDSA } ];
        }
        
        $.each(accounts, function(index, account) {            
            promises.push(
                new Promise(function(resolve, reject) {                
                    $.ajax({
                        method: "POST",
                        url: ONLYONET.AppSettings.client_endpoint + "/document/password",
                        contentType: "application/json",                        
                        data: JSON.stringify({
                                            "enrollmentID": ONLYONET.AppSettings.CurrentUser.enrollmentID, 
                                            "fileHash": fileHash,
                                            "filePassword": filePassword, 
                                            "recipientPublicKeyECDSA": account.publicKey
                                            }),
                        success: function(result) {
                            resolve(result);
                        },
                        error: function(result) {
                            reject(result.responseJSON.error);
                        }
                    });
                })                
            );
        });

        return Promise.all(promises);
    },
    isFilePasswordExist: function (fileHash, publicKeyECDSA) {
        const resp = $.ajax({
            method: "POST",
            url: ONLYONET.AppSettings.client_endpoint + "/document/password/exist",
            contentType: "application/json",
            async: false,
            dataType: 'json',
            data: JSON.stringify({
                                   "enrollmentID": ONLYONET.AppSettings.CurrentUser.enrollmentID, 
                                   "fileHash": fileHash, 
                                   "publicKeyECDSA": publicKeyECDSA
                                })
        }).responseJSON;

        return (resp.result == "true");
    },
    getFilePassword: function (fileHash) {
        const resp = $.ajax({
            method: "POST",
            url: ONLYONET.AppSettings.client_endpoint + "/document/password/get",
            contentType: "application/json",
            async: false,
            dataType: 'json',
            data: JSON.stringify({
                                   "enrollmentID": ONLYONET.AppSettings.CurrentUser.enrollmentID, 
                                   "fileHash": fileHash, 
                                   "privateKeyECIES": ONLYONET.AppSettings.CurrentUser.privateKeyECIES
                                })
        }).responseJSON;

        return resp.password;
    }
}
})();