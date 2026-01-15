#ifndef CORS_RESOURCE_HANDLER_H
#define CORS_RESOURCE_HANDLER_H

#ifdef CEF_VERSION_ABOVE_102

#define CEF_SUPPORT_STREAMING_CORS_RESOURCE_HANDLER

#include "include/cef_resource_handler.h"
#include "include/cef_urlrequest.h"
#include "include/wrapper/cef_closure_task.h"
#include <vector>
#include <string>
#include <mutex>

#define CALL_AND_CLEAR_CALLBACK(callback_ptr, ...) \
do {                                               \
	if (callback_ptr) {                            \
		auto temp_callback = callback_ptr;         \
		callback_ptr = nullptr;                    \
		temp_callback->Continue(__VA_ARGS__);      \
	}                                              \
} while(0)

//#define CEF_SUPPORT_STREAMING_CORS_RESOURCE_HANDLER_LOG_DATA
#ifdef CEF_SUPPORT_STREAMING_CORS_RESOURCE_HANDLER_LOG_DATA
void LOG_DATA(void* data, int data_len)
{
	if (data == NULL || data_len <= 0)
		return;

	FILE* f = fopen("D:/stream_data_log.txt", "ab");
	if (!f) return;

	fwrite(data, 1, data_len, f);
	fwrite("\n\n", 1, 2, f);

	fclose(f);
}
#else
void LOG_DATA(void* data, int data_len) {}
#endif

class StreamingURLRequestClient;

class StreamingCORSResourceHandler : public CefResourceHandler
{
public:
	explicit StreamingCORSResourceHandler(CefRefPtr<CefRequest> request);

	bool Open(CefRefPtr<CefRequest> request,
			  bool& handle_request,
			  CefRefPtr<CefCallback> callback) override;

	void GetResponseHeaders(CefRefPtr<CefResponse> response,
							int64& response_length,
							CefString& redirectUrl) override;

	bool Read(void* data_out,
			  int bytes_to_read,
			  int& bytes_read,
			  CefRefPtr<CefResourceReadCallback> callback) override;

	void Cancel() override;

	void OnData(const void* data, size_t size);
	void OnComplete(CefRefPtr<CefURLRequest> request);

private:
	friend class StreamingURLRequestClient;

	CefRefPtr<CefRequest> m_originalRequest;
	CefRefPtr<CefURLRequest> m_urlRequest;

	CefRefPtr<CefCallback> m_openCallback;

	std::recursive_mutex m_mutex;

	std::vector<char> m_buffer;
	void* m_pendingDataOut;
	int m_pendingBytesToRead;

	bool m_completed;

	CefRefPtr<CefResourceReadCallback> m_pendingCallback;

	int m_status;
	CefString m_statusText;
	CefString m_mimeType;
	CefResponse::HeaderMap m_headers;

	IMPLEMENT_REFCOUNTING(StreamingCORSResourceHandler);
};

class StreamingURLRequestClient : public CefURLRequestClient
{
public:
	explicit StreamingURLRequestClient(CefRefPtr<StreamingCORSResourceHandler> handler)
		: m_handler(handler)
	{
	}

	~StreamingURLRequestClient()
	{
	}

	void OnDownloadData(CefRefPtr<CefURLRequest> request,
						const void* data,
						size_t size) override
	{
		m_handler->OnData(data, size);
	}

	void OnRequestComplete(CefRefPtr<CefURLRequest> request) override
	{
		m_handler->OnComplete(request);
	}

	void OnUploadProgress(CefRefPtr<CefURLRequest>, int64, int64) override {}
	void OnDownloadProgress(CefRefPtr<CefURLRequest>, int64, int64) override {}

	bool GetAuthCredentials(bool, const CefString&, int, const CefString&,
							const CefString&, CefRefPtr<CefAuthCallback>) override
	{
		return false;
	}

private:
	CefRefPtr<StreamingCORSResourceHandler> m_handler;
	IMPLEMENT_REFCOUNTING(StreamingURLRequestClient);
};

StreamingCORSResourceHandler::StreamingCORSResourceHandler(CefRefPtr<CefRequest> request)
	: m_originalRequest(request)
	  , m_pendingDataOut(nullptr)
	  , m_pendingBytesToRead(0)
	  , m_completed(false)
	  , m_status(200)
{
	std::string url = request->GetURL().ToString();

	const std::string prefix = "onlyoffice-proxy://";
	if (url.find(prefix) == 0)
	{
		std::string path = url.substr(prefix.size());

		if (path.find("https/") == 0)
			path = "https://" + path.substr(6);
		else if (path.find("http/") == 0)
			path = "http://" + path.substr(5);

		m_originalRequest = CefRequest::Create();
		m_originalRequest->SetURL(path);
		m_originalRequest->SetMethod(request->GetMethod());
		m_originalRequest->SetReferrer(request->GetReferrerURL(),
									   request->GetReferrerPolicy());

		CefRequest::HeaderMap headers;
		request->GetHeaderMap(headers);
		m_originalRequest->SetHeaderMap(headers);

		if (CefRefPtr<CefPostData> post = request->GetPostData()) {
			m_originalRequest->SetPostData(post);
		}

		m_originalRequest->SetFlags(request->GetFlags());
		m_originalRequest->SetFirstPartyForCookies(request->GetFirstPartyForCookies());
	}
}

bool StreamingCORSResourceHandler::Open(CefRefPtr<CefRequest> request,
										bool& handle_request,
										CefRefPtr<CefCallback> callback) {
	handle_request = false;
	m_openCallback = callback;

	CefPostTask(TID_UI, base::BindOnce(
							[](CefRefPtr<StreamingCORSResourceHandler> self) {
								std::string url = self->m_originalRequest->GetURL().ToString();

								CefRefPtr<StreamingURLRequestClient> client = new StreamingURLRequestClient(self);

								self->m_urlRequest = CefURLRequest::Create(self->m_originalRequest, client.get(), CefRequestContext::GetGlobalContext());

								if (!self->m_urlRequest)
								{
									if (self->m_openCallback)
									{
										self->m_openCallback->Cancel();
										self->m_openCallback = nullptr;
									}
								}
							},
							CefRefPtr<StreamingCORSResourceHandler>(this)
							));

	return true;
}

void StreamingCORSResourceHandler::GetResponseHeaders(CefRefPtr<CefResponse> response,
													  int64& response_length,
													  CefString& redirectUrl)
{
	CefResponse::HeaderMap headers = m_headers;

	headers.insert(std::make_pair("Access-Control-Allow-Origin", "*"));
	headers.insert(std::make_pair("Access-Control-Allow-Methods", "*"));
	headers.insert(std::make_pair("Access-Control-Allow-Headers", "*"));
	headers.insert(std::make_pair("Access-Control-Expose-Headers", "*"));

	response->SetHeaderMap(headers);
	response->SetStatus(m_status);
	response->SetStatusText(m_statusText);
	response->SetMimeType(m_mimeType);

	response_length = -1;
}

bool StreamingCORSResourceHandler::Read(void* data_out,
										int bytes_to_read,
										int& bytes_read,
										CefRefPtr<CefResourceReadCallback> callback)
{
	std::lock_guard<std::recursive_mutex> lock(m_mutex);

	bytes_read = 0;

	// Try to read from buffer
	if (!m_buffer.empty())
	{
		int n = std::min(bytes_to_read, (int)m_buffer.size());
		memcpy(data_out, m_buffer.data(), n);
		m_buffer.erase(m_buffer.begin(), m_buffer.begin() + n);
		bytes_read = n;

		LOG_DATA(data_out, n);
		return true;
	}

	if (m_completed)
		return false;

	// Wait for data
	m_pendingCallback = callback;
	m_pendingBytesToRead = bytes_to_read;
	m_pendingDataOut = data_out;
	return true;
}

void StreamingCORSResourceHandler::OnData(const void* data, size_t size)
{
	std::lock_guard<std::recursive_mutex> lock(m_mutex);

	// Add to buffer
	m_buffer.insert(m_buffer.end(), (const char*)data, (const char*)data + size);

	// Call Open callback ONLY on first data
	CALL_AND_CLEAR_CALLBACK(m_openCallback);

	// Notify pending Read callback if exists
	if (m_pendingCallback && m_pendingDataOut)
	{
		int n = std::min(m_pendingBytesToRead, (int)m_buffer.size());
		memcpy(m_pendingDataOut, m_buffer.data(), n);
		m_buffer.erase(m_buffer.begin(), m_buffer.begin() + n);

		LOG_DATA(m_pendingDataOut, n);

		m_pendingDataOut = nullptr;
		m_pendingBytesToRead = 0;

		CALL_AND_CLEAR_CALLBACK(m_pendingCallback, n);
	}
}

void StreamingCORSResourceHandler::OnComplete(CefRefPtr<CefURLRequest> request)
{
	std::lock_guard<std::recursive_mutex> lock(m_mutex);

	CefURLRequest::ErrorCode error = request->GetRequestError();

	if (CefRefPtr<CefResponse> resp = request->GetResponse())
	{
		m_status = resp->GetStatus();
		m_statusText = resp->GetStatusText();
		m_mimeType = resp->GetMimeType();
		resp->GetHeaderMap(m_headers);
	}

	m_completed = true;

	// If Open never got data
	CALL_AND_CLEAR_CALLBACK(m_openCallback);

	// Wake up pending Read
	CALL_AND_CLEAR_CALLBACK(m_pendingCallback, 0);
}

void StreamingCORSResourceHandler::Cancel()
{
	if (m_urlRequest)
		m_urlRequest->Cancel();	
}

#endif // CEF_VERSION_ABOVE_102

#endif // CORS_RESOURCE_HANDLER_H
