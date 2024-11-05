# QR Certificate Generator

A web application built with Next.js and FastAPI that allows you to generate verifiable certificates with QR codes. This tool helps organizations create, manage, and verify digital certificates efficiently.

## Features

-   Generate certificates from templates
-   Automatic QR code generation for verification
-   Bulk certificate generation from Excel data
-   GitHub Pages integration for certificate hosting
-   Web-based interface for easy management
-   Verification system through QR codes

## Prerequisites

Before you begin, ensure you have the following installed:

-   Node.js
-   Python
-   pip

You'll also need:

-   A certificate template (PNG/JPG)
-   An Excel sheet with recipient details
-   A GitHub account for hosting certificates

## Installation

1. Clone the repository:

```bash
git clone https://github.com/cbitosc/qr-certificate-generator.git
cd qr-verifiable-certificate-generator
```

2. Install dependencies:

```bash
npm install
pip install -r requirements.txt
```

## Usage

1. Start the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

This command will automatically start both the Next.js frontend and FastAPI backend.

2. Open your browser and navigate to `http://localhost:3000`

## Certificate Generation Process

1. **Prepare Your Template**

    - Create a certificate template with space for text and a QR code, then export it as a PNG or JPG.
    - Convert the template to SVG format using tools like [Pixelied PNG to SVG Converter](https://pixelied.com/convert/png-converter/png-to-svg)

2. **Setup GitHub Repository**

    - Create a new public repository on GitHub
    - Enable GitHub Pages in repository settings
    - Configure Pages to use the main branch and `/docs` folder

3. **Generate Certificates**

    - Enter your GitHub details to generate the base URL
    - Upload your certificate template
    - Import recipient data from Excel
    - Generate certificates with QR codes
    - Download the generated `docs` folder

4. **Deploy Certificates**
    - Upload the generated `docs` folder to your GitHub repository
    - Certificates will be accessible via GitHub Pages
    - QR codes will link to verification pages

## Verification Process

1. Scan the QR code on any certificate
2. The QR code links to a unique verification page
3. The verification page displays certificate authenticity and details

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the GNU General Public License v3.0 (GPLv3) - see the [LICENSE](LICENSE) file for details.

This means you are free to:

-   Use this software for any purpose
-   Change the software to suit your needs
-   Share the software and your changes with others

Under the following conditions:

-   If you distribute your modified version, you must pass on to the recipients the same freedoms and require them to do the same
-   You must include the source code, or make it freely available
-   You must state any significant changes made to the software
-   You must keep intact all licensing notices

For more details see the [full license text](https://www.gnu.org/licenses/gpl-3.0.en.html).
