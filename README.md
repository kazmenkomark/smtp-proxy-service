# SMTP Proxy Service

This service is a Node.js application designed for sending emails from a website or other applications. It provides a simple HTTP API endpoint to send emails, with configurable security features like CORS, rate limiting, and sender/recipient control.

## Features

*   **Email Sending:** Sends emails via an SMTP transporter (Nodemailer).
*   **Configurable API:** Allows clients to specify subject, text, and optionally 'from' and 'to' addresses.
*   **CORS Control:** Restrict API access to specific origins.
*   **Rate Limiting:** Protects against abuse by limiting the number of requests per minute from a single IP address.
*   **Email Validation:** Validates 'from' and 'to' email addresses.
*   **Secure Credentials:** Uses environment variables for sensitive SMTP passwords.
*   **Detailed Error Messages:** Provides more informative error responses to clients.
*   **Secure Architecture:** Keeps all sensitive SMTP credentials on the server-side, preventing exposure of authentication details to clients.

## How it Works

The SMTP Proxy service is an Express.js application that exposes a single POST endpoint `/send`. When a request is received:

1.  It applies rate limiting to prevent abuse.
2.  It checks CORS policies to ensure the request comes from an allowed origin.
3.  It validates the presence of required `subject` and `text` fields in the request body.
4.  It determines the 'from' and 'to' email addresses based on the `allowClientOverrides` configuration:
    *   If `allowClientOverrides` is `true`, it uses the 'from' and 'to' provided in the request body, falling back to configured defaults if not present.
    *   If `allowClientOverrides` is `false`, it strictly uses the configured 'from' and 'to' addresses, returning an error if the client attempts to override them.
5.  It validates the format of the final 'from' and 'to' email addresses.
6.  It uses Nodemailer to send the email via the configured SMTP server using server-side credentials.
7.  It returns a success or error response to the client.

## Security Architecture

This service provides a secure way to send emails from web applications by keeping all sensitive information on the server:

*   **Server-side Authentication:** SMTP credentials (username/password) are stored securely on the server and never exposed to client applications.
*   **Minimal Client Requirements:** Clients only need to send the email subject and content, without requiring access to authentication details.
*   **Configurable Access Control:** Fine-grained control over whether clients can specify custom 'from' and 'to' addresses using the `allowClientOverrides` setting.
*   **Secure Transmission:** Client data is transmitted via HTTPS when deployed behind a reverse proxy.

## Setup and Installation

1.  **Clone the repository:**
    ```bash
    git clone <repository_url>
    cd teleshop/utils/smtp-proxy-service
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    ```

## Configuration

The service is configured via `config.json` and environment variables.

### `config.json`

```json
{
  "port": 3000,
  "cors": {
    "allowedOrigins": [] // Array of allowed origins (e.g., ["https://your-frontend.com"]). Empty array allows all origins.
  },
  "rateLimit": {
    "maxRequestsPerMinute": 5 // Maximum number of requests allowed per minute from a single IP.
  },
  "smtp": {
    "host": "smtp.example.com",
    "port": 587,
    "secure": false,
    "auth": {
      "user": "service@example.com" // SMTP username (email address)
      // "pass" is taken from environment variable SMTP_PASS
    }
  },
  "mailer": {
    "from": "service@example.com", // Default 'from' address for emails
    "to": "admin@example.com",   // Default 'to' address for emails
    "allowClientOverrides": false        // If true, clients can override 'from' and 'to' in their requests. If false, client-provided 'from'/'to' will result in an error.
  }
}
```

### Environment Variables

The SMTP password must be provided via an environment variable for security reasons.

*   `SMTP_PASS`: The password for your SMTP user (e.g., `gVbDwX3pv8eNmx3uVno5`).

**Example:**
```bash
export SMTP_PASS="your_smtp_password"
```
Or, for production, use a `.env` file with a package like `dotenv` (not included by default, but recommended).

## Running the Service

1.  **Set the `SMTP_PASS` environment variable:**
    ```bash
    export SMTP_PASS="your_smtp_password"
    ```
2.  **Start the server:**
    ```bash
    npm start
    ```
    The server will listen on the port specified in `config.json` (default: 3000).

## API Endpoint

### `POST /send`

Sends an email with the provided details.

**Request Body (JSON):**

```json
{
  "subject": "Your email subject",  // Required: The subject of the email
  "text": "Your email body text",    // Required: The plain text body of the email
  "from": "sender@example.com", // Optional: Overrides config.mailer.from if allowClientOverrides is true
  "to": "recipient@example.com" // Optional: Overrides config.mailer.to if allowClientOverrides is true
}
```

**Example Request (using `curl`):**

```bash
curl -X POST -H "Content-Type: application/json" \
     -d '{
           "subject": "Hello from SMTP Proxy Service",
           "text": "This is a test email sent from the SMTP Proxy service.",
           "to": "user@example.com"
         }' \
     http://localhost:3000/send
```

**Responses:**

*   **`200 OK`**: Email sent successfully.
    ```json
    { "message": "Request sent successfully" }
    ```
*   **`400 Bad Request`**: Missing required fields, invalid email address, or client override not allowed.
    ```json
    { "message": "Subject and text are required" }
    // or
    { "message": "Invalid 'to' email address: invalid-email" }
    // or
    { "message": "Overriding 'from' address is not allowed" }
    ```
*   **`429 Too Many Requests`**: Rate limit exceeded.
    ```json
    { "message": "Too many requests from this IP, please try again after a minute" }
    ```
*   **`500 Internal Server Error`**: An error occurred during email sending (e.g., SMTP server issue).
    ```json
    { "message": "Nodemailer failed to send" }
    ```

## Security Considerations

### HTTPS

For production environments, it is **highly recommended** to run this service behind a reverse proxy (e.g., Nginx) that handles HTTPS. The SMTP Proxy service itself runs on HTTP, and Nginx would manage the SSL/TLS termination.

**Example Nginx Configuration:**

```nginx
server {
    listen 80;
    server_name api.yourdomain.com; # Replace with your API domain
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name api.yourdomain.com; # Replace with your API domain

    ssl_certificate /etc/letsencrypt/live/api.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3000; # Replace 3000 with your SMTP Proxy service port
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### CORS

Ensure `config.json`'s `cors.allowedOrigins` is configured correctly to prevent unauthorized cross-origin requests.

## Testing

To run the automated tests for this service:

1.  **Set the `SMTP_PASS` environment variable:**
    ```bash
    export SMTP_PASS="your_test_smtp_password"
    ```
    (A placeholder password is sufficient for tests as `nodemailer` is mocked).
2.  **Run tests:**
    ```bash
    npm test
    ```

The tests cover basic functionality, validation, `allowClientOverrides` logic, rate limiting, and error handling.