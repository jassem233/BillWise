# BillWais Local Development

BillWais in this repository is a standalone browser application built with HTML, CSS, and vanilla JavaScript. It can be served by XAMPP Apache without a framework build step. The interface uses an Arial font family and a blue color theme.

## Current Architecture

- `index.html`, `styles.css`, and `app.js` make up the application.
- The app stores bill records and letter drafts in the current browser's `localStorage`. Optional attachments are stored in that browser as data URLs and are limited to 1 MB each.
- Bill images and PDFs are sent from the local PHP proxy to OCR.Space for text extraction. Extracted fields are suggestions for the user to review before saving.
- Bill records can include service-period dates, account/meter number, previous and present readings, payment due date, itemized charge lines, and notes. If consumption is left blank but both readings are entered, the app derives their difference.
- Sample bill data is provided for demonstration when no saved records exist.
- `api/ocr.php` forwards uploaded files to OCR.Space with a server-side API key from `private/ocr-space-config.php`. The `private/` directory is blocked by Apache and the key file is Git-ignored.
- There is no database schema, user authentication, React/Vite build, or Base44 SDK integration in this repository.
- OCR.Space processes the document outside this device. Review all extracted fields before saving and avoid uploading bills unless you are comfortable with the service's privacy policy.

This storage is for a local demo only. Browser data is not shared between users or devices, is not backed up, and is not appropriate for sensitive records on shared computers. Clearing browser site data can remove the saved records and drafts.

## Prerequisites

- XAMPP for Windows with Apache and PHP. PHP cURL and fileinfo extensions must be enabled. MySQL/MariaDB is not required by this app.
- Visual Studio Code.
- Node.js and npm are not required. The app has no JavaScript package dependencies or frontend build step.
- Git is optional if you are working from a Git clone.

## Install and Run with XAMPP

1. Open `C:\xampp\htdocs\BillWais` in Visual Studio Code. If the project is elsewhere, copy or clone the project folder under `C:\xampp\htdocs\` so Apache can serve it.
2. Open the XAMPP Control Panel and start **Apache**. Start **MySQL** as well only if you are setting up a separate database-backed feature; BillWais does not currently connect to MySQL.
3. If Apache reports that its port is already in use, stop the conflicting service or configure Apache to use an available port, then use that port in the URL.
4. No `npm install` or frontend build is required. Apache serves the HTML, CSS, JavaScript, and PHP endpoint directly.
5. No database setup is needed for the existing app. For future local PHP/API development, start MySQL, open `http://localhost/phpmyadmin/`, and create a dedicated local database there. Add and review a schema migration before connecting application code; this repository currently has no schema or database credentials. Never point a local build at a production database.
6. Put your newly issued OCR.Space key in `private/ocr-space-config.php`. That file is excluded from Git and the directory is blocked from direct web access. The key pasted in chat should be considered exposed; revoke it and use a newly generated key. Never put the key in JavaScript or commit the local config file.
7. Open **`http://localhost/BillWais/`** in a browser. The XAMPP document root is normally `C:\xampp\htdocs\`.

You can also open `index.html` directly, but using the Apache URL is the recommended local setup and matches the intended XAMPP workflow.

## VS Code Workflow

Edit the HTML, CSS, and JavaScript files in VS Code, then refresh the browser. No watcher or compilation step is needed. Browser developer tools can be used to inspect JavaScript errors and local storage. The logo area is intentionally a placeholder for a manually added logo.

## Local Data and Privacy

Records are saved under the browser's `localStorage` for the current site origin. Opening the app through `file://` and through `http://localhost/BillWais/` uses separate browser storage. The selected bill is sent to OCR.Space through the PHP proxy; OCR text is returned for review and is not saved automatically by the endpoint. Uploads are limited to 1 MB; OCR.Space's free plan currently limits PDF processing to three pages. The application has no account system or database. Concern letters are drafts that the user reviews and sends through their own email app or prints; BillWais does not submit them.

## Base44 Migration Status

No Base44 imports, SDK calls, authentication, entities, or backend functions were found in the available application source. The local OCR.Space proxy is a PHP endpoint and does not depend on Base44. There is no authentication system or MySQL schema to configure.

## Verification Status

- Apache successfully served the application at `http://localhost/BillWais/` and the dashboard rendered in the browser.
- PHP syntax checks passed for the OCR.Space proxy and local config. PHP cURL and fileinfo are enabled in the XAMPP installation.
- A live OCR.Space request using a synthetic bill image populated the review form, including itemized charges. Direct HTTP access to `private/ocr-space-config.php` returned 403.
- Rotate the key shared in chat and replace it in the ignored local config before continued use.
- Browser form tests verified utility selection, charge-line add/remove, consumption calculation, and persistence of dates, readings, charges, and notes. Temporary test records were deleted.
- A browser smoke test added a temporary bill, confirmed it remained after reload, and deleted it. No page errors were reported, and the test record was removed.
- The old browser OCR dependencies and npm manifests were removed.
- There is no database configuration or schema to connect or validate.
- There is no npm package manifest or frontend build command.
- Browser storage, comparison, archive, and letter-draft behavior are client-side features; this is not a multi-user or production-secure deployment.