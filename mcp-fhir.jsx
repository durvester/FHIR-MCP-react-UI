import React, { useState } from 'react';
import { AlertCircle, Copy, Eye, EyeOff, User, Key, Server, Stethoscope, Brain, Play, Globe } from 'lucide-react';

// Constants
const FHIR_BASE_URL = "https://fhir.ehr-company.com";
const MCP_BASE_URL = "https://mcp.ehr-company.com";
const AUTH_BASE_URL = "https://auth.ehr-company.com";

const DEMO_CREDENTIALS = {
    username: 'dr.smith@hospital.com',
    password: 'demo123'
};

// FHIR R4 compliant patient data based on Inferno
const HARDCODED_PATIENT = {
    resourceType: "Patient",
    id: "patient-123",
    meta: {
        versionId: "2",
        lastUpdated: "2024-08-20T10:30:00Z",
        profile: ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient"]
    },
    text: {
        status: "generated",
        div: "<div xmlns=\"http://www.w3.org/1999/xhtml\">John William Doe</div>"
    },
    extension: [
        {
            url: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-race",
            extension: [
                {
                    url: "ombCategory",
                    valueCoding: {
                        system: "urn:oid:2.16.840.1.113883.6.238",
                        code: "2106-3",
                        display: "White"
                    }
                },
                {
                    url: "text",
                    valueString: "White"
                }
            ]
        },
        {
            url: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-ethnicity",
            extension: [
                {
                    url: "ombCategory",
                    valueCoding: {
                        system: "urn:oid:2.16.840.1.113883.6.238",
                        code: "2186-5",
                        display: "Not Hispanic or Latino"
                    }
                },
                {
                    url: "text",
                    valueString: "Not Hispanic or Latino"
                }
            ]
        },
        {
            url: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-birthsex",
            valueCode: "M"
        }
    ],
    identifier: [
        {
            system: "https://github.com/synthetichealth/synthea",
            value: "e91975f5-9445-c11f-cabf-c3c6dae161f2"
        },
        {
            type: {
                coding: [
                    {
                        system: "http://terminology.hl7.org/CodeSystem/v2-0203",
                        code: "MR",
                        display: "Medical record number"
                    }
                ],
                text: "Medical record number"
            },
            system: "http://hospital.smarthealthit.org",
            value: "e91975f5-9445-c11f-cabf-c3c6dae161f2"
        }
    ],
    active: true,
    name: [
        {
            use: "official",
            family: "Doe",
            given: ["John", "William"],
            prefix: ["Mr."]
        }
    ],
    telecom: [
        {
            system: "phone",
            value: "555-123-4567",
            use: "home"
        }
    ],
    gender: "male",
    birthDate: "1980-03-15",
    address: [
        {
            line: ["123 Main Street"],
            city: "Boston",
            state: "MA",
            postalCode: "02101",
            country: "US"
        }
    ],
    maritalStatus: {
        coding: [
            {
                system: "http://terminology.hl7.org/CodeSystem/v3-MaritalStatus",
                code: "M",
                display: "Married"
            }
        ],
        text: "Married"
    }
};

// SMART on FHIR scopes based on Inferno
const SMART_SCOPES = {
    'openid': 'OpenID Connect identity',
    'fhirUser': 'FHIR user identity',
    'offline_access': 'Refresh token access',
    'patient/Patient.rs': 'Read patient demographics',
    'patient/Observation.rs': 'Read patient observations',
    'patient/Condition.rs': 'Read patient conditions',
    'patient/MedicationRequest.rs': 'Read patient medications',
    'patient/DiagnosticReport.rs': 'Read patient diagnostic reports',
    'patient/AllergyIntolerance.rs': 'Read patient allergies',
    'patient/Procedure.rs': 'Read patient procedures',
    'mcp/tool.summarize_patient': 'AI tool: Patient summary generation',
    'mcp/tool.analyze_vitals': 'AI tool: Vital signs analysis'
};

// JWT utility functions
const createJWT = (payload) => {
    const header = { alg: 'HS256', typ: 'JWT' };
    const now = Math.floor(Date.now() / 1000);
    const fullPayload = {
        ...payload,
        iat: now,
        exp: now + (payload.exp || 3600)
    };

    const encodedHeader = btoa(JSON.stringify(header));
    const encodedPayload = btoa(JSON.stringify(fullPayload));
    const signature = btoa('mock-signature-' + Math.random().toString(36).substr(2, 16));

    return `${encodedHeader}.${encodedPayload}.${signature}`;
};

const decodeJWT = (token) => {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;
        return JSON.parse(atob(parts[1]));
    } catch {
        return null;
    }
};

export default function InteractiveFHIRMCPDemo() {
    // State management
    const [activeTab, setActiveTab] = useState('register');
    const [registeredApps, setRegisteredApps] = useState([]);
    const [currentApp, setCurrentApp] = useState(null);
    const [fhirBaseUrl, setFhirBaseUrl] = useState('');
    const [discoveryConfig, setDiscoveryConfig] = useState(null);
    const [discoveryError, setDiscoveryError] = useState('');

    // Authorization state - separate for FHIR and MCP
    const [fhirAuthStep, setFhirAuthStep] = useState('start');
    const [mcpAuthStep, setMcpAuthStep] = useState('start');
    const [fhirSelectedScopes, setFhirSelectedScopes] = useState([]);
    const [mcpSelectedScopes, setMcpSelectedScopes] = useState([]);
    const [fhirAuthCode, setFhirAuthCode] = useState('');
    const [mcpAuthCode, setMcpAuthCode] = useState('');
    const [tokens, setTokens] = useState({});
    const [showTokenDetails, setShowTokenDetails] = useState(false);

    // API testing state
    const [apiRequest, setApiRequest] = useState({
        method: 'GET',
        endpoint: '',
        headers: {},
        body: ''
    });
    const [apiResponse, setApiResponse] = useState(null);
    const [fhirLoading, setFhirLoading] = useState(false);
    const [mcpLoading, setMcpLoading] = useState(false);

    // MCP state
    const [mcpToolCall, setMcpToolCall] = useState({
        tool: 'summarize_patient',
        parameters: '{"patient_id": "patient-123"}'
    });
    const [mcpResponse, setMcpResponse] = useState(null);

    // App Registration
    const registerApp = () => {
        const clientId = 'app-' + Math.random().toString(36).substr(2, 9);
        const clientSecret = 'secret-' + Math.random().toString(36).substr(2, 16);

        const newApp = {
            clientId,
            clientSecret,
            name: 'Healthcare AI Assistant',
            redirectUri: 'https://app.example.com/callback'
        };

        setRegisteredApps([...registeredApps, newApp]);
        setCurrentApp(newApp);
    };

    // Discovery - based on Inferno format
    const getSmartConfiguration = () => {
        return {
            token_endpoint_auth_signing_alg_values_supported: ["RS384", "ES384"],
            capabilities: [
                "launch-ehr",
                "launch-standalone",
                "client-public",
                "client-confidential-asymmetric",
                "sso-openid-connect",
                "context-ehr-patient",
                "context-standalone-patient",
                "permission-offline",
                "permission-patient",
                "permission-user"
            ],
            code_challenge_methods_supported: ["S256"],
            introspection_endpoint: `${AUTH_BASE_URL}/oauth/token/introspect`,
            grant_types_supported: ["authorization_code", "client_credentials"],
            jwks_uri: `${AUTH_BASE_URL}/.well-known/jwk`,
            scopes_supported: Object.keys(SMART_SCOPES),
            issuer: AUTH_BASE_URL,
            authorization_endpoint: `${AUTH_BASE_URL}/oauth/authorization`,
            token_endpoint: `${AUTH_BASE_URL}/oauth/token`,
            mcp_endpoint: MCP_BASE_URL,
            smart_style_url: `${AUTH_BASE_URL}/app/smart-style-url`
        };
    };

    const discoverConfiguration = () => {
        setDiscoveryError('');

        if (!fhirBaseUrl) {
            setDiscoveryError('Please enter a FHIR base URL');
            return;
        }

        setTimeout(() => {
            if (fhirBaseUrl === FHIR_BASE_URL) {
                setDiscoveryConfig(getSmartConfiguration());
            } else {
                setDiscoveryError('FHIR server not found. Use: ' + FHIR_BASE_URL);
            }
        }, 500);
    };

    // Authorization Flow - updated to handle separate FHIR and MCP flows
    const startAuthorization = (resource) => {
        if (!currentApp || !discoveryConfig) return;

        if (resource === FHIR_BASE_URL) {
            setFhirAuthStep('login');
            setFhirSelectedScopes(['openid', 'fhirUser', 'offline_access']);
        } else {
            setMcpAuthStep('login');
            setMcpSelectedScopes(['openid', 'fhirUser', 'offline_access']);
        }
    };

    const handleLogin = (username, password, resourceType) => {
        if (username === DEMO_CREDENTIALS.username && password === DEMO_CREDENTIALS.password) {
            if (resourceType === 'fhir') {
                setFhirAuthStep('approve');
            } else {
                setMcpAuthStep('approve');
            }
        } else {
            alert('Invalid credentials. Use: ' + DEMO_CREDENTIALS.username + ' / ' + DEMO_CREDENTIALS.password);
        }
    };

    const handleScopeApproval = (resourceType) => {
        const code = 'auth-code-' + Math.random().toString(36).substr(2, 12);

        if (resourceType === 'fhir') {
            setFhirAuthCode(code);
            setFhirAuthStep('callback');
            // Exchange token immediately
            setTimeout(() => {
                exchangeTokensForFHIR(code);
            }, 1000);
        } else {
            setMcpAuthCode(code);
            setMcpAuthStep('callback');
            // Exchange token immediately  
            setTimeout(() => {
                exchangeTokensForMCP(code);
            }, 1000);
        }
    };

    const exchangeTokensForFHIR = (authCode) => {
        if (!authCode || !currentApp) {
            console.error('Missing authCode or currentApp for FHIR');
            return;
        }

        setFhirLoading(true);

        setTimeout(() => {
            const accessTokenPayload = {
                iss: AUTH_BASE_URL,
                sub: 'user-dr-smith-123',
                aud: FHIR_BASE_URL,
                client_id: currentApp.clientId,
                scope: fhirSelectedScopes.join(' '),
                fhirUser: 'Practitioner/practitioner-dr-smith'
            };

            const accessToken = createJWT(accessTokenPayload);
            const refreshToken = createJWT({
                ...accessTokenPayload,
                token_type: 'refresh_token'
            });
            const idToken = createJWT({
                iss: AUTH_BASE_URL,
                sub: 'user-dr-smith-123',
                aud: currentApp.clientId,
                fhirUser: `${FHIR_BASE_URL}/Practitioner/practitioner-dr-smith`
            });

            const tokenResponse = {
                access_token: accessToken,
                refresh_token: refreshToken,
                patient: "patient-123",
                scope: fhirSelectedScopes.join(' '),
                need_patient_banner: false,
                id_token: idToken,
                smart_style_url: `${AUTH_BASE_URL}/app/smart-style-url`,
                token_type: "bearer",
                expires_in: 3600
            };

            setTokens(prev => ({
                ...prev,
                [FHIR_BASE_URL]: tokenResponse
            }));

            setFhirAuthStep('complete');
            setFhirLoading(false);
        }, 1000);
    };

    const exchangeTokensForMCP = (authCode) => {
        if (!authCode || !currentApp) {
            console.error('Missing authCode or currentApp for MCP');
            return;
        }

        setMcpLoading(true);

        setTimeout(() => {
            const accessTokenPayload = {
                iss: AUTH_BASE_URL,
                sub: 'user-dr-smith-123',
                aud: MCP_BASE_URL,
                client_id: currentApp.clientId,
                scope: mcpSelectedScopes.join(' '),
                fhirUser: 'Practitioner/practitioner-dr-smith'
            };

            const accessToken = createJWT(accessTokenPayload);
            const refreshToken = createJWT({
                ...accessTokenPayload,
                token_type: 'refresh_token'
            });
            const idToken = createJWT({
                iss: AUTH_BASE_URL,
                sub: 'user-dr-smith-123',
                aud: currentApp.clientId,
                fhirUser: `${FHIR_BASE_URL}/Practitioner/practitioner-dr-smith`
            });

            const tokenResponse = {
                access_token: accessToken,
                refresh_token: refreshToken,
                patient: "patient-123",
                scope: mcpSelectedScopes.join(' '),
                need_patient_banner: false,
                id_token: idToken,
                smart_style_url: `${AUTH_BASE_URL}/app/smart-style-url`,
                token_type: "bearer",
                expires_in: 3600
            };

            setTokens(prev => ({
                ...prev,
                [MCP_BASE_URL]: tokenResponse
            }));

            setMcpAuthStep('complete');
            setMcpLoading(false);
        }, 1000);
    };

    // FHIR API calls
    const executeAPIRequest = () => {
        const resourceTokens = tokens[FHIR_BASE_URL];

        if (!resourceTokens) {
            setApiResponse({ error: 'No access token available for ' + FHIR_BASE_URL });
            return;
        }

        setFhirLoading(true);

        setTimeout(() => {
            let response;

            switch (apiRequest.endpoint) {
                case '/Patient/patient-123':
                    response = HARDCODED_PATIENT;
                    break;
                case '/Observation?patient=patient-123':
                    response = {
                        resourceType: "Bundle",
                        type: "searchset",
                        total: 1,
                        entry: [{
                            resource: {
                                resourceType: "Observation",
                                id: "blood-pressure",
                                status: "final",
                                code: {
                                    coding: [{
                                        system: "http://loinc.org",
                                        code: "85354-9",
                                        display: "Blood pressure panel"
                                    }]
                                },
                                subject: { reference: "Patient/patient-123" },
                                effectiveDateTime: "2024-08-20T09:30:00Z"
                            }
                        }]
                    };
                    break;
                default:
                    response = {
                        resourceType: "OperationOutcome",
                        issue: [{
                            severity: "error",
                            code: "not-found",
                            diagnostics: "Endpoint not found"
                        }]
                    };
            }

            setApiResponse({
                status: response.resourceType === "OperationOutcome" ? 404 : 200,
                headers: {
                    'Content-Type': 'application/fhir+json',
                    'Date': new Date().toISOString()
                },
                body: response
            });

            setFhirLoading(false);
        }, 800);
    };

    // MCP Tool execution
    const executeMCPTool = () => {
        const mcpTokens = tokens[MCP_BASE_URL];

        if (!mcpTokens) {
            setMcpResponse({ error: 'No MCP access token available' });
            return;
        }

        setMcpLoading(true);

        setTimeout(() => {
            let result;

            switch (mcpToolCall.tool) {
                case 'summarize_patient':
                    result = {
                        content: [{
                            type: "text",
                            text: "**Patient Summary for John Doe**\n\n**Demographics:** 44-year-old male\n\n**Clinical Notes:** Patient shows stable condition with recent assessments documented."
                        }],
                        _meta: {
                            tokenExchangePerformed: true,
                            fhirResourcesAccessed: ["Patient/patient-123"],
                            internalNote: "MCP server exchanged user token for FHIR access token using RFC 8693"
                        }
                    };
                    break;

                case 'analyze_vitals':
                    result = {
                        content: [{
                            type: "text",
                            text: "**Vital Signs Analysis**\n\n**Recent Vitals:** Normal parameters observed\n\n**Recommendations:**\n- Continue monitoring\n- Regular follow-up"
                        }],
                        _meta: {
                            tokenExchangePerformed: true,
                            fhirResourcesAccessed: ["Observation?patient=patient-123"],
                            internalNote: "MCP server exchanged user token for FHIR access token using RFC 8693"
                        }
                    };
                    break;

                default:
                    result = { error: 'Tool not found' };
            }

            setMcpResponse(result);
            setMcpLoading(false);
        }, 1200);
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
    };

    const renderAuthorizationFlow = (resourceType) => {
        const isFhir = resourceType === 'fhir';
        const resourceUrl = isFhir ? FHIR_BASE_URL : MCP_BASE_URL;
        const authStep = isFhir ? fhirAuthStep : mcpAuthStep;
        const selectedScopes = isFhir ? fhirSelectedScopes : mcpSelectedScopes;
        const setSelectedScopes = isFhir ? setFhirSelectedScopes : setMcpSelectedScopes;
        const authCode = isFhir ? fhirAuthCode : mcpAuthCode;
        const colorClass = isFhir ? 'green' : 'purple';

        if (authStep === 'start') {
            return (
                <div className="space-y-4">
                    <div className="text-sm text-gray-600 space-y-2">
                        <p><strong>Resource:</strong> {resourceUrl}</p>
                        <p><strong>Authorization Endpoint:</strong> {discoveryConfig.authorization_endpoint}</p>
                    </div>
                    <button
                        onClick={() => startAuthorization(resourceUrl)}
                        className={`w-full bg-${colorClass}-600 text-white py-2 rounded hover:bg-${colorClass}-700`}
                    >
                        Start {resourceType.toUpperCase()} Authorization
                    </button>
                </div>
            );
        }

        if (authStep === 'login') {
            return (
                <div className="space-y-4">
                    <div className="bg-blue-50 border border-blue-200 rounded p-4">
                        <p className="text-blue-800 text-sm">Redirecting to authorization server...</p>
                        <code className="text-xs text-blue-600 break-all">
                            {discoveryConfig.authorization_endpoint}?response_type=code&client_id={currentApp.clientId}&redirect_uri={currentApp.redirectUri}&scope=openid&resource={resourceUrl}
                        </code>
                    </div>

                    <div className="border rounded p-4 bg-white">
                        <h5 className="font-medium mb-3">EHR Login Screen</h5>
                        <div className="space-y-3">
                            <div>
                                <label className="block text-sm font-medium mb-1">Username</label>
                                <input
                                    type="email"
                                    defaultValue={DEMO_CREDENTIALS.username}
                                    className="w-full border rounded px-3 py-2 text-sm"
                                    id={`${resourceType}-username`}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Password</label>
                                <input
                                    type="password"
                                    defaultValue={DEMO_CREDENTIALS.password}
                                    className="w-full border rounded px-3 py-2 text-sm"
                                    id={`${resourceType}-password`}
                                />
                            </div>

                            <button
                                onClick={() => {
                                    const username = document.getElementById(`${resourceType}-username`).value;
                                    const password = document.getElementById(`${resourceType}-password`).value;
                                    handleLogin(username, password, resourceType);
                                }}
                                className={`w-full bg-${colorClass}-600 text-white py-2 rounded hover:bg-${colorClass}-700`}
                            >
                                Login
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        if (authStep === 'approve') {
            return (
                <div className="space-y-4">
                    <div className="bg-green-50 border border-green-200 rounded p-4">
                        <p className="text-green-800 text-sm">Login successful!</p>
                    </div>

                    <div className="border rounded p-4 bg-white">
                        <h5 className="font-medium mb-3">Grant Permissions</h5>
                        <p className="text-sm text-gray-600 mb-3">Healthcare AI Assistant is requesting access to:</p>

                        <div className="space-y-2 max-h-48 overflow-y-auto text-sm">
                            {Object.entries(SMART_SCOPES)
                                .filter(([scope]) => isFhir ? !scope.startsWith('mcp/') : scope.startsWith('mcp/') || ['openid', 'fhirUser', 'offline_access'].includes(scope))
                                .map(([scope, description]) => (
                                    <label key={scope} className="flex items-start space-x-2">
                                        <input
                                            type="checkbox"
                                            checked={selectedScopes.includes(scope)}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setSelectedScopes([...selectedScopes, scope]);
                                                } else {
                                                    setSelectedScopes(selectedScopes.filter(s => s !== scope));
                                                }
                                            }}
                                            className="mt-1"
                                        />
                                        <div>
                                            <code className={`text-xs text-${colorClass}-600`}>{scope}</code>
                                            <div className="text-gray-600">{description}</div>
                                        </div>
                                    </label>
                                ))}
                        </div>

                        <div className="flex space-x-2 mt-4">
                            <button
                                onClick={() => {
                                    if (isFhir) {
                                        setFhirAuthStep('login');
                                    } else {
                                        setMcpAuthStep('login');
                                    }
                                }}
                                className="px-4 py-2 border border-gray-300 rounded text-sm hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleScopeApproval(resourceType)}
                                className={`flex-1 bg-${colorClass}-600 text-white py-2 rounded hover:bg-${colorClass}-700`}
                            >
                                Authorize
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        if (authStep === 'callback') {
            return (
                <div className="space-y-4">
                    <div className="bg-green-50 border border-green-200 rounded p-4">
                        <p className="text-green-800 text-sm">Authorization successful!</p>
                        <p className="text-green-700 text-xs mt-1">Redirect to: {currentApp.redirectUri}?code={authCode}</p>
                    </div>

                    <div className="space-y-3">
                        <div>
                            <label className="block text-sm font-medium mb-1">Authorization Code</label>
                            <code className="block bg-gray-100 p-2 rounded text-sm">{authCode}</code>
                        </div>
                        <div className="bg-blue-50 border border-blue-200 rounded p-3">
                            <p className="text-blue-800 text-sm">Exchanging authorization code for access token...</p>
                        </div>
                    </div>
                </div>
            );
        }

        if (authStep === 'complete' && tokens[resourceUrl]) {
            return (
                <div className="space-y-4">
                    <div className={`bg-${colorClass}-50 border border-${colorClass}-200 rounded p-4`}>
                        <p className={`text-${colorClass}-800 text-sm font-medium`}>{resourceType.toUpperCase()} Access Token Received</p>
                    </div>

                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <h5 className="font-medium text-sm">Token Response</h5>
                            <button
                                onClick={() => setShowTokenDetails(!showTokenDetails)}
                                className="text-blue-600 hover:text-blue-800"
                            >
                                {showTokenDetails ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>

                        <div className="bg-gray-50 border rounded p-3 text-sm">
                            <div>Token Type: {tokens[resourceUrl].token_type}</div>
                            <div>Expires In: {tokens[resourceUrl].expires_in} seconds</div>
                            <div>Patient: {tokens[resourceUrl].patient}</div>
                            <div>Scope: {tokens[resourceUrl].scope}</div>
                        </div>

                        {showTokenDetails && (
                            <div className="space-y-2">
                                <div>
                                    <div className="text-sm font-medium">Complete Token Response:</div>
                                    <pre className="bg-gray-900 text-gray-100 p-3 rounded text-xs overflow-x-auto max-h-64">
                                        {JSON.stringify(tokens[resourceUrl], null, 2)}
                                    </pre>
                                </div>
                                <div>
                                    <div className="text-sm font-medium">Access Token Claims:</div>
                                    <pre className="bg-gray-900 text-gray-100 p-3 rounded text-xs overflow-x-auto max-h-32">
                                        {JSON.stringify(decodeJWT(tokens[resourceUrl].access_token), null, 2)}
                                    </pre>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            );
        }

        return null;
    };

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="bg-white shadow-sm border-b">
                <div className="max-w-7xl mx-auto px-4 py-4">
                    <h1 className="text-2xl font-bold text-gray-900">Interactive FHIR-MCP Authorization Demo</h1>
                    <p className="text-gray-600 mt-1">Experience the unified authorization flow as a healthcare app developer</p>
                </div>
            </div>

            <div className="max-w-7xl mx-auto p-4">
                <div className="bg-white rounded-lg shadow-sm border mb-6">
                    <div className="border-b">
                        <nav className="flex space-x-8 px-6 overflow-x-auto">
                            {[
                                { id: 'register', label: 'App Registration', icon: User },
                                { id: 'discovery', label: 'Discovery', icon: Globe },
                                { id: 'auth', label: 'Authorization', icon: Key },
                                { id: 'fhir-api', label: 'FHIR API Testing', icon: Stethoscope },
                                { id: 'mcp-tools', label: 'MCP Tool Testing', icon: Brain }
                            ].map(({ id, label, icon: Icon }) => (
                                <button
                                    key={id}
                                    onClick={() => setActiveTab(id)}
                                    className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 whitespace-nowrap ${activeTab === id
                                            ? 'border-blue-500 text-blue-600'
                                            : 'border-transparent text-gray-500 hover:text-gray-700'
                                        }`}
                                >
                                    <Icon className="w-4 h-4" />
                                    <span>{label}</span>
                                </button>
                            ))}
                        </nav>
                    </div>

                    <div className="p-6">
                        {activeTab === 'register' && (
                            <div className="space-y-6">
                                <div>
                                    <h3 className="text-lg font-medium text-gray-900 mb-4">OAuth 2.0 Client Registration</h3>
                                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                                        <p className="text-blue-800 text-sm">Register your healthcare application to receive OAuth 2.0 client credentials</p>
                                    </div>

                                    <button
                                        onClick={registerApp}
                                        className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center space-x-2"
                                    >
                                        <User className="w-4 h-4" />
                                        <span>Register Healthcare App</span>
                                    </button>
                                </div>

                                {registeredApps.map((app, idx) => (
                                    <div key={idx} className="bg-gray-50 border rounded-lg p-6">
                                        <h4 className="font-medium text-gray-900 mb-4">{app.name}</h4>
                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-sm">
                                            <div>
                                                <label className="block text-gray-600 mb-2 font-medium">Client ID</label>
                                                <div className="flex items-center space-x-2">
                                                    <code className="bg-white p-3 border rounded flex-1 font-mono text-sm">{app.clientId}</code>
                                                    <button
                                                        onClick={() => copyToClipboard(app.clientId)}
                                                        className="p-2 text-gray-500 hover:text-gray-700"
                                                        title="Copy to clipboard"
                                                    >
                                                        <Copy className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-gray-600 mb-2 font-medium">Client Secret</label>
                                                <div className="flex items-center space-x-2">
                                                    <code className="bg-white p-3 border rounded flex-1 font-mono text-sm">{app.clientSecret}</code>
                                                    <button
                                                        onClick={() => copyToClipboard(app.clientSecret)}
                                                        className="p-2 text-gray-500 hover:text-gray-700"
                                                        title="Copy to clipboard"
                                                    >
                                                        <Copy className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="lg:col-span-2">
                                                <label className="block text-gray-600 mb-2 font-medium">Redirect URI</label>
                                                <code className="bg-white p-3 border rounded block font-mono text-sm">{app.redirectUri}</code>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => setCurrentApp(app)}
                                            className={`mt-4 px-4 py-2 rounded text-sm font-medium ${currentApp && currentApp.clientId === app.clientId
                                                    ? 'bg-green-100 text-green-800 border border-green-200'
                                                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                                }`}
                                        >
                                            {currentApp && currentApp.clientId === app.clientId ? 'Currently Selected' : 'Select for Testing'}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {activeTab === 'discovery' && (
                            <div className="space-y-6">
                                <div>
                                    <h3 className="text-lg font-medium text-gray-900 mb-4">SMART on FHIR Discovery</h3>
                                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                                        <p className="text-yellow-800 text-sm">Enter a FHIR base URL to discover the authorization server and capabilities</p>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">FHIR Base URL</label>
                                        <div className="flex space-x-2">
                                            <input
                                                type="url"
                                                value={fhirBaseUrl}
                                                onChange={(e) => setFhirBaseUrl(e.target.value)}
                                                placeholder="https://fhir.ehr-company.com"
                                                className="flex-1 border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                            <button
                                                onClick={discoverConfiguration}
                                                disabled={!fhirBaseUrl}
                                                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center space-x-2"
                                            >
                                                <Globe className="w-4 h-4" />
                                                <span>Discover</span>
                                            </button>
                                        </div>
                                        <p className="text-xs text-gray-500 mt-1">Try: {FHIR_BASE_URL}</p>
                                    </div>

                                    {discoveryError && (
                                        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                                            <p className="text-red-800 text-sm">{discoveryError}</p>
                                        </div>
                                    )}

                                    {discoveryConfig && (
                                        <div className="space-y-4">
                                            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                                                <p className="text-green-800 text-sm font-medium">Discovery successful!</p>
                                            </div>

                                            <div>
                                                <h4 className="font-medium text-gray-700 mb-3">GET {fhirBaseUrl}/.well-known/smart-configuration</h4>
                                                <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-sm overflow-x-auto max-h-96">
                                                    {JSON.stringify(discoveryConfig, null, 2)}
                                                </pre>
                                            </div>

                                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                                <div className="flex items-start space-x-2">
                                                    <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
                                                    <div>
                                                        <p className="text-blue-800 font-medium">Enhanced Configuration</p>
                                                        <p className="text-blue-700 text-sm mt-1">
                                                            Notice the <code className="bg-blue-100 px-1 rounded">mcp_endpoint</code> in the configuration -
                                                            this enables unified authorization for both FHIR and MCP resources.
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {activeTab === 'auth' && (
                            <div className="space-y-6">
                                <div>
                                    <h3 className="text-lg font-medium text-gray-900 mb-4">OAuth 2.0 Authorization Code Flow</h3>
                                    {!currentApp && (
                                        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                                            <p className="text-red-800 text-sm">Please register and select an app first</p>
                                        </div>
                                    )}
                                    {!discoveryConfig && currentApp && (
                                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                                            <p className="text-yellow-800 text-sm">Please complete discovery first to get authorization endpoints</p>
                                        </div>
                                    )}
                                </div>

                                {currentApp && discoveryConfig && (
                                    <div className="space-y-6">
                                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                            <div className="flex items-start space-x-2">
                                                <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
                                                <div>
                                                    <p className="text-blue-800 font-medium">Unified Authorization Architecture</p>
                                                    <p className="text-blue-700 text-sm mt-1">
                                                        Your app can authorize for FHIR APIs, MCP tools, or both independently.
                                                        Same authorization server, same client credentials, different resource parameters.
                                                        The authorization server handles scope validation and mapping internally.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                            <div className="border rounded-lg p-6">
                                                <h4 className="font-medium text-gray-900 mb-4 flex items-center space-x-2">
                                                    <Server className="w-5 h-5 text-green-600" />
                                                    <span>FHIR Server Authorization</span>
                                                </h4>
                                                {renderAuthorizationFlow('fhir')}
                                            </div>

                                            <div className="border rounded-lg p-6">
                                                <h4 className="font-medium text-gray-900 mb-4 flex items-center space-x-2">
                                                    <Brain className="w-5 h-5 text-purple-600" />
                                                    <span>MCP Server Authorization</span>
                                                </h4>
                                                <div className="bg-purple-50 border border-purple-200 rounded p-4 mb-4">
                                                    <p className="text-purple-800 text-sm">Independent authorization flow - same auth server, different resource parameter</p>
                                                </div>
                                                {renderAuthorizationFlow('mcp')}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'fhir-api' && (
                            <div className="space-y-6">
                                <div>
                                    <h3 className="text-lg font-medium text-gray-900 mb-4">FHIR API Testing</h3>
                                    {!tokens[FHIR_BASE_URL] && (
                                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                                            <p className="text-yellow-800 text-sm">Complete FHIR authorization first to get access tokens</p>
                                        </div>
                                    )}
                                </div>

                                {tokens[FHIR_BASE_URL] && (
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                        <div className="space-y-4">
                                            <h4 className="font-medium text-gray-700">API Request Builder</h4>

                                            <div className="border rounded-lg p-4">
                                                <div className="space-y-4">
                                                    <div className="flex space-x-2">
                                                        <select
                                                            value={apiRequest.method}
                                                            onChange={(e) => setApiRequest(prev => ({ ...prev, method: e.target.value }))}
                                                            className="border rounded px-3 py-2 text-sm"
                                                        >
                                                            <option value="GET">GET</option>
                                                            <option value="POST">POST</option>
                                                        </select>
                                                        <div className="flex-1 flex">
                                                            <span className="bg-gray-100 px-3 py-2 border border-r-0 rounded-l text-sm font-mono">
                                                                {FHIR_BASE_URL}
                                                            </span>
                                                            <input
                                                                type="text"
                                                                value={apiRequest.endpoint}
                                                                onChange={(e) => setApiRequest(prev => ({ ...prev, endpoint: e.target.value }))}
                                                                placeholder="/Patient/patient-123"
                                                                className="flex-1 border border-l-0 rounded-r px-3 py-2 text-sm font-mono"
                                                            />
                                                        </div>
                                                    </div>

                                                    <div className="space-y-2">
                                                        <label className="block text-sm font-medium">Quick Examples:</label>
                                                        <div className="space-y-1">
                                                            {[
                                                                { endpoint: '/Patient/patient-123', desc: 'Get patient demographics' },
                                                                { endpoint: '/Observation?patient=patient-123', desc: 'Get patient observations' }
                                                            ].map(({ endpoint, desc }) => (
                                                                <button
                                                                    key={endpoint}
                                                                    onClick={() => setApiRequest(prev => ({ ...prev, endpoint }))}
                                                                    className="block text-left w-full p-2 text-sm bg-gray-50 hover:bg-gray-100 rounded border"
                                                                >
                                                                    <code className="text-blue-600">{endpoint}</code>
                                                                    <div className="text-gray-600 text-xs">{desc}</div>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    <div className="space-y-2">
                                                        <label className="block text-sm font-medium">Headers</label>
                                                        <div className="bg-gray-50 p-3 rounded text-sm">
                                                            <div>Authorization: Bearer {tokens[FHIR_BASE_URL].access_token.substring(0, 20)}...</div>
                                                            <div>Accept: application/fhir+json</div>
                                                        </div>
                                                    </div>

                                                    <button
                                                        onClick={executeAPIRequest}
                                                        disabled={fhirLoading || !apiRequest.endpoint}
                                                        className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700 disabled:opacity-50 flex items-center justify-center space-x-2"
                                                    >
                                                        <Play className="w-4 h-4" />
                                                        <span>{fhirLoading ? 'Executing...' : 'Execute Request'}</span>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-4">
                                            <h4 className="font-medium text-gray-700">Response</h4>

                                            {apiResponse && (
                                                <div className="border rounded-lg">
                                                    <div className="border-b p-3 bg-gray-50">
                                                        <div className="flex items-center space-x-4 text-sm">
                                                            <div className={`font-medium ${apiResponse.status === 200 ? 'text-green-600' : 'text-red-600'}`}>
                                                                {apiResponse.status} {apiResponse.status === 200 ? 'OK' : 'Error'}
                                                            </div>
                                                            <div className="text-gray-500">
                                                                Content-Type: {apiResponse.headers && apiResponse.headers['Content-Type']}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="p-0">
                                                        <pre className="bg-gray-900 text-gray-100 p-4 text-xs overflow-x-auto max-h-96 rounded-b">
                                                            {JSON.stringify(apiResponse.body, null, 2)}
                                                        </pre>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'mcp-tools' && (
                            <div className="space-y-6">
                                <div>
                                    <h3 className="text-lg font-medium text-gray-900 mb-4">MCP Tool Inspector</h3>
                                    {!tokens[MCP_BASE_URL] && (
                                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                                            <p className="text-yellow-800 text-sm">Complete MCP authorization first to get access tokens</p>
                                        </div>
                                    )}
                                </div>

                                {tokens[MCP_BASE_URL] && (
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                        <div className="space-y-4">
                                            <h4 className="font-medium text-gray-700">Tool Call Builder</h4>

                                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                                <div className="flex items-start space-x-2">
                                                    <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
                                                    <div>
                                                        <p className="text-blue-800 font-medium">Internal Token Exchange</p>
                                                        <p className="text-blue-700 text-sm mt-1">
                                                            MCP server will exchange your token for FHIR access internally using RFC 8693.
                                                            This process is transparent to your application.
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="border rounded-lg p-4">
                                                <div className="space-y-4">
                                                    <div>
                                                        <label className="block text-sm font-medium mb-2">Available Tools</label>
                                                        <select
                                                            value={mcpToolCall.tool}
                                                            onChange={(e) => setMcpToolCall(prev => ({ ...prev, tool: e.target.value }))}
                                                            className="w-full border rounded px-3 py-2 text-sm"
                                                        >
                                                            <option value="summarize_patient">summarize_patient - Generate patient summary</option>
                                                            <option value="analyze_vitals">analyze_vitals - Analyze vital signs</option>
                                                        </select>
                                                    </div>

                                                    <div>
                                                        <label className="block text-sm font-medium mb-2">Tool Parameters (JSON)</label>
                                                        <textarea
                                                            value={mcpToolCall.parameters}
                                                            onChange={(e) => setMcpToolCall(prev => ({ ...prev, parameters: e.target.value }))}
                                                            rows={4}
                                                            className="w-full border rounded px-3 py-2 text-sm font-mono"
                                                            placeholder='{"patient_id": "patient-123"}'
                                                        />
                                                    </div>

                                                    <div className="space-y-2">
                                                        <label className="block text-sm font-medium">Request Headers</label>
                                                        <div className="bg-gray-50 p-3 rounded text-sm">
                                                            <div>Authorization: Bearer {tokens[MCP_BASE_URL].access_token.substring(0, 20)}...</div>
                                                            <div>Content-Type: application/json</div>
                                                        </div>
                                                    </div>

                                                    <button
                                                        onClick={executeMCPTool}
                                                        disabled={mcpLoading}
                                                        className="w-full bg-purple-600 text-white py-2 rounded hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center space-x-2"
                                                    >
                                                        <Brain className="w-4 h-4" />
                                                        <span>{mcpLoading ? 'Calling Tool...' : 'Call MCP Tool'}</span>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-4">
                                            <h4 className="font-medium text-gray-700">Tool Response</h4>

                                            {mcpResponse && (
                                                <div className="space-y-4">
                                                    {mcpResponse._meta && (
                                                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                                                            <h5 className="text-sm font-medium text-yellow-800 mb-2">Internal Process Metadata</h5>
                                                            <div className="space-y-1 text-xs text-yellow-700">
                                                                <div>Token Exchange: {mcpResponse._meta.tokenExchangePerformed ? 'Performed' : 'Not needed'}</div>
                                                                <div>FHIR Resources: {mcpResponse._meta.fhirResourcesAccessed && mcpResponse._meta.fhirResourcesAccessed.join(', ')}</div>
                                                                <div className="text-yellow-600 italic">{mcpResponse._meta.internalNote}</div>
                                                            </div>
                                                        </div>
                                                    )}

                                                    <div className="border rounded-lg">
                                                        <div className="border-b p-3 bg-gray-50">
                                                            <div className="font-medium text-sm text-purple-600">
                                                                MCP Tool Response
                                                            </div>
                                                        </div>

                                                        <div className="p-4">
                                                            {mcpResponse.content && mcpResponse.content[0] && (
                                                                <div className="prose prose-sm max-w-none">
                                                                    <div dangerouslySetInnerHTML={{
                                                                        __html: mcpResponse.content[0].text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>')
                                                                    }} />
                                                                </div>
                                                            )}

                                                            {mcpResponse.error && (
                                                                <div className="text-red-600 text-sm">{mcpResponse.error}</div>
                                                            )}
                                                        </div>

                                                        <div className="border-t p-3 bg-gray-50">
                                                            <details className="text-xs">
                                                                <summary className="cursor-pointer text-gray-600">Raw JSON Response</summary>
                                                                <pre className="bg-gray-900 text-gray-100 p-3 rounded mt-2 overflow-x-auto">
                                                                    {JSON.stringify(mcpResponse, null, 2)}
                                                                </pre>
                                                            </details>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}