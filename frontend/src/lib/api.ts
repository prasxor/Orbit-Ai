export async function callBackend(endpoint: string, options: RequestInit = {}) {
  // Use environment variable for backend URL, fallback to localhost for local dev
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  // Check if body is FormData to prevent overwriting the browser's automatic
  // multipart/form-data boundary headers.
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;

  const defaultHeaders: Record<string, string> = {};
  if (!isFormData) {
    defaultHeaders["Content-Type"] = "application/json";
  }

  try {
    const response = await fetch(`${baseUrl}${endpoint}`, {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || errorData.error || "Backend request failed");
    }

    return response.json();
  } catch (error: any) {
    // Intercept CORS / 502 / Offline "Failed to fetch" errors gracefully
    if (error.message === "Failed to fetch" || error.name === "TypeError" || error.message.includes("NetworkError")) {
      throw new Error(
        "Cannot connect to the backend server. It may be deploying a new update or is currently offline. Please wait a moment and try again."
      );
    }
    throw error;
  }
}
