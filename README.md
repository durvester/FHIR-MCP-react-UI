# FHIR-MCP Authorization Demo

Interactive React component demonstrating OAuth 2.0 authorization flow for healthcare applications that need to access both FHIR resources and MCP (AI) tools.

## Features

- OAuth 2.0 client registration simulation
- SMART on FHIR discovery process
- Dual authorization flows (FHIR + MCP)
- FHIR API testing with mock patient data
- MCP tool execution with AI capabilities

## Local Development

```bash
npm install
npm run dev
```

## Production Build

```bash
npm run build
npm run preview
```

## Deployment

This project is configured for GitHub Pages deployment. The GitHub Action will automatically build and deploy when you push to the main branch.

## Demo Credentials

- Username: `dr.smith@hospital.com`
- Password: `demo123`
- FHIR Base URL: `https://fhir.ehr-company.com`