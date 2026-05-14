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

#ifndef ASC_CEFCONVERTER_FILECONVERTER_X2T_H
#define ASC_CEFCONVERTER_FILECONVERTER_X2T_H

#ifdef LINUX
#include <unistd.h>
#include <sys/wait.h>
#include <stdio.h>
#endif

#include "../include/applicationmanager.h"
#include "../../../../core/DesktopEditor/common/File.h"
#include "../../../../core/DesktopEditor/common/StringBuilder.h"

namespace NSX2T
{
	static int Convert(const std::wstring& sConverterPath, const std::wstring sXmlPath, CAscApplicationManager* pManager, bool bIsLoggingErrors = false)
	{
		int nReturnCode = 0;
		std::wstring sConverterExe = sConverterPath;

#ifdef WIN32
		sConverterExe += L".exe";
		std::wstring sApp = L"x2t ";

		STARTUPINFO sturtupinfo;
		ZeroMemory(&sturtupinfo,sizeof(STARTUPINFO));
		sturtupinfo.cb = sizeof(STARTUPINFO);

		sApp += (L"\"" + sXmlPath + L"\"");
		wchar_t* pCommandLine = NULL;
		if (true)
		{
			pCommandLine = new wchar_t[sApp.length() + 1];
			memcpy(pCommandLine, sApp.c_str(), sApp.length() * sizeof(wchar_t));
			pCommandLine[sApp.length()] = (wchar_t)'\0';
		}

		HANDLE ghJob = CreateJobObject(NULL, NULL);

		if (ghJob)
		{
			JOBOBJECT_EXTENDED_LIMIT_INFORMATION jeli = { 0 };

			// Configure all child processes associated with the job to terminate when the
			jeli.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
			if ( 0 == SetInformationJobObject( ghJob, JobObjectExtendedLimitInformation, &jeli, sizeof(jeli)))
			{
				CloseHandle(ghJob);
				ghJob = NULL;
			}
		}

		PROCESS_INFORMATION processinfo;
		ZeroMemory(&processinfo,sizeof(PROCESS_INFORMATION));
		BOOL bResult = CreateProcessW(sConverterExe.c_str(), pCommandLine,
									  NULL, NULL, TRUE, CREATE_NO_WINDOW, NULL, NULL, &sturtupinfo, &processinfo);

		if (bResult && ghJob)
		{
			AssignProcessToJobObject(ghJob, processinfo.hProcess);
		}

		::WaitForSingleObject(processinfo.hProcess, INFINITE);

		RELEASEARRAYOBJECTS(pCommandLine);

		//get exit code
		DWORD dwExitCode = 0;
		if (GetExitCodeProcess(processinfo.hProcess, &dwExitCode))
		{
			nReturnCode = (int)dwExitCode;
		}

		CloseHandle(processinfo.hProcess);
		CloseHandle(processinfo.hThread);

		if (ghJob)
		{
			CloseHandle(ghJob);
			ghJob = NULL;
		}

#endif

#ifdef LINUX
		pid_t pid = fork(); // create child process
		int status;

		std::string sProgramm = U_TO_UTF8(sConverterExe);
		std::string sXmlA = U_TO_UTF8(sXmlPath);

		switch (pid)
		{
		case -1: // error
			break;

		case 0: // child process
		{
			std::string sLibraryDir = sProgramm;
			std::string sPATH = sProgramm;
			if (std::string::npos != sProgramm.find_last_of('/'))
			{
				sLibraryDir = "LD_LIBRARY_PATH=" + sProgramm.substr(0, sProgramm.find_last_of('/'));
#ifndef _MAC
				sLibraryDir += ":";
				sLibraryDir += pManager->GetLibraryPathVariable();
#endif
				sPATH = "PATH=" + sProgramm.substr(0, sProgramm.find_last_of('/'));
			}

#ifdef _MAC
			sLibraryDir = "DY" + sLibraryDir;
#endif

			const char* nargs[3];
			nargs[0] = sProgramm.c_str();
			nargs[1] = sXmlA.c_str();
			nargs[2] = NULL;

#ifndef _MAC
			const char* nenv[4];
			std::string s1 = "APPLICATION_NAME=" + pManager->m_oSettings.converter_application_name;
			std::string s2 = "COMPANY_NAME=" + pManager->m_oSettings.converter_application_company;
			nenv[0] = sLibraryDir.c_str();
			nenv[1] = s1.c_str();
			nenv[2] = s2.c_str();
			nenv[3] = NULL;
#else
			const char* nenv[5];
			std::string s1 = "APPLICATION_NAME=" + pManager->m_oSettings.converter_application_name;
			std::string s2 = "COMPANY_NAME=" + pManager->m_oSettings.converter_application_company;
			nenv[0] = sLibraryDir.c_str();
			nenv[1] = sPATH.c_str();
			nenv[2] = s1.c_str();
			nenv[3] = s2.c_str();
			nenv[4] = NULL;
#endif

			execve(sProgramm.c_str(),
				   (char * const *)nargs,
				   (char * const *)nenv);
			exit(EXIT_SUCCESS);
			break;
		}
		default: // parent process, pid now contains the child pid
			while (-1 == waitpid(pid, &status, 0)); // wait for child to complete
			if (WIFEXITED(status))
			{
				nReturnCode =  WEXITSTATUS(status);
			}
			break;
		}
#endif

		if (bIsLoggingErrors && nReturnCode != 0)
		{
			std::string sXmlContent;
			NSFile::CFileBinary::ReadAllTextUtf8A(sXmlPath, sXmlContent);
			NSStringUtils::string_replaceA(sXmlContent, "%", "%%");

			std::wstring sLogFile = NSFile::GetDirectoryName(sXmlPath) + L"/errors.log";
			std::string sLogFileA = U_TO_UTF8(sLogFile);
			FILE* f = fopen(sLogFileA.c_str(), "a+");
			fprintf(f, "--------------------------------------------------------\n");
			fprintf(f, "error: %d\nxml:\n", nReturnCode);
			fprintf(f, sXmlContent.c_str());
			fprintf(f, "\n\n");
			fclose(f);
		}

		return nReturnCode;
	}
}

#endif // ASC_CEFCONVERTER_FILECONVERTER_X2T_H
