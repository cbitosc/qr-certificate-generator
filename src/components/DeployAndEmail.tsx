"use client";

import { useState, useEffect } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { AgGridReact } from "ag-grid-react";
import { ColDef } from "ag-grid-community";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-quartz.css";
import { useTheme } from "next-themes";

export default function DeployAndEmail() {
    const { data: session } = useSession();
    const { resolvedTheme } = useTheme();

    const [outputDir, setOutputDir] = useState("");

    // GitHub
    const [githubToken, setGithubToken] = useState("");
    const [repoOwner, setRepoOwner] = useState("");
    const [repoName, setRepoName] = useState("");
    const [deployStatus, setDeployStatus] = useState("");
    const [availableDirs, setAvailableDirs] = useState<string[]>([]);

    useEffect(() => {
        fetch("/api/list-directories").then(r => r.json()).then(d => {
            if (d.directories) {
                setAvailableDirs(d.directories);
            }
        }).catch(e => console.error("Could not fetch dirs", e));

        const saved = sessionStorage.getItem("latestOutputDir");
        if (saved && !outputDir) {
            setOutputDir(saved);
        }
    }, []);

    // Email
    const [emailCol, setEmailCol] = useState("Email Address");
    const [nameCol, setNameCol] = useState("Name");
    const [emailSubject, setEmailSubject] = useState("Your Certificate is Ready");
    const [emailBody, setEmailBody] = useState("Dear {Name},\n\nPlease find attached your certificate.\n\nBest regards,\nAutomated System");
    const [emailCC, setEmailCC] = useState("");
    const [emailStatus, setEmailStatus] = useState("");
    const [report, setReport] = useState<any[]>([]);

    // Preview
    const [previewData, setPreviewData] = useState<any[]>([]);
    const [previewCols, setPreviewCols] = useState<ColDef[]>([]);

    const handleLoadPreview = async () => {
        if (!outputDir) {
            alert("Please enter the Target Output Directory first.");
            return;
        }
        try {
            const res = await fetch(`/api/preview-data?output_directory=${encodeURIComponent(outputDir)}`);
            if (!res.ok) {
                const text = await res.text();
                alert("Failed to load preview: " + text);
                return;
            }
            const data = await res.json();
            if (data.data && data.data.length > 0) {
                const keys = Object.keys(data.data[0]);
                setPreviewCols(keys.map(k => ({ field: k, flex: 1 })));
                setPreviewData(data.data);
            } else {
                setPreviewData([]);
                alert("No data found.");
            }
        } catch(e: any) {
            alert("Error loading preview: " + e.message);
        }
    };

    const handleDeploy = async () => {
        if (!outputDir || !githubToken || !repoOwner || !repoName) {
            alert("Please fill all GitHub deployment fields.");
            return;
        }

        setDeployStatus("Deploying to GitHub... This might take a minute.");
        try {
            const formData = new FormData();
            formData.append("output_directory", outputDir);
            formData.append("github_token", githubToken);
            formData.append("repo_owner", repoOwner);
            formData.append("repo_name", repoName);

            const res = await fetch("/api/deploy-github", {
                method: "POST",
                body: formData,
            });

            if (res.ok) {
                const data = await res.json();
                setDeployStatus("Successfully deployed to GitHub! " + data.message);
            } else {
                const err = await res.text();
                setDeployStatus("Deployment failed: " + err);
            }
        } catch (e: any) {
            setDeployStatus("Error: " + e.message);
        }
    };

    const handleSendEmails = async () => {
        if (!outputDir || !emailCol || !nameCol) {
            alert("Please fill basic Email configuration fields.");
            return;
        }

        const accessToken = session?.accessToken;
        if (!accessToken) {
            alert("You must sign in with Google first to send emails.");
            return;
        }

        setEmailStatus("Connecting to stream...");
        setReport([]);
        try {
            const formData = new FormData();
            formData.append("output_directory", outputDir);
            formData.append("email_col", emailCol);
            formData.append("name_col", nameCol);
            formData.append("access_token", accessToken);
            formData.append("subject", emailSubject);
            formData.append("body_text", emailBody);
            formData.append("cc_emails", emailCC);

            const res = await fetch("/api/send-emails", {
                method: "POST",
                body: formData,
            });

            if (!res.body) {
                setEmailStatus("Failed: No response stream");
                return;
            }

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let isDone = false;
            let partialLine = "";

            while (!isDone) {
                const { value, done } = await reader.read();
                if (done) {
                    isDone = true;
                    break;
                }
                const chunk = decoder.decode(value, { stream: true });
                const text = partialLine + chunk;
                const lines = text.split("\n");
                partialLine = lines.pop() || ""; // last piece might be incomplete
                
                for (const line of lines) {
                    if (line.trim() === "") continue;
                    try {
                        const parsed = JSON.parse(line);
                        if (parsed.type === "info") {
                            setEmailStatus(parsed.message);
                        } else if (parsed.type === "result") {
                            setEmailStatus(`Sending... (${parsed.status.toUpperCase()}) to ${parsed.email}`);
                            setReport(prev => [...prev, parsed]);
                        } else if (parsed.type === "done") {
                            setEmailStatus(`Finished. Success: ${parsed.success_count}, Failed: ${parsed.failed_count}`);
                        } else if (parsed.type === "error") {
                            setEmailStatus(`Error: ${parsed.message}`);
                        }
                    } catch(jsonErr) {
                        console.error("Failed to parse chunk", line);
                    }
                }
            }
        } catch (e: any) {
            setEmailStatus("Error: " + e.message);
        }
    };

    return (
        <div className="flex flex-col px-8 py-8 text-foreground max-w-6xl mx-auto mt-8">
            <h2 className="text-primary text-4xl font-semibold mb-2">Distribute Certificates</h2>
            <p className="text-muted-foreground mb-8 text-lg">Deploy generated certificates to a GitHub organization or email them directly to participants securely.</p>

            <div className="mb-8 border p-6 rounded-lg shadow-sm bg-card">
                <h3 className="text-xl font-medium mb-4">1. Select Target Output</h3>
                <label className="block mb-2 text-sm text-muted-foreground">The folder name where your generated certificates were saved (e.g. hfestP)</label>
                <div className="flex space-x-4">
                    <Input
                        value={outputDir}
                        onChange={(e) => setOutputDir(e.target.value)}
                        placeholder="Output directory name"
                        className="max-w-md bg-secondary border"
                        list="local-directories"
                        required
                    />
                    <datalist id="local-directories">
                        {availableDirs.map(dir => (
                            <option key={dir} value={dir} />
                        ))}
                    </datalist>
                    <Button onClick={handleLoadPreview}>Load Excel Preview</Button>
                </div>
                
                {previewData.length > 0 && (
                    <div className="mt-6 animation-fade-in duration-300 transition-all">
                        <h4 className="text-sm font-medium mb-2">Data Preview ({previewData.length} records found)</h4>
                        <div
                            className={`w-full h-80 border rounded-lg overflow-hidden ${
                                resolvedTheme == "dark"
                                    ? "ag-theme-quartz-dark"
                                    : "ag-theme-quartz"
                            }`}
                        >
                            <AgGridReact
                                rowData={previewData}
                                columnDefs={previewCols}
                                domLayout="normal"
                            />
                        </div>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Email Section */}
                <div className="border p-6 rounded-lg shadow-sm bg-card">
                    <h3 className="text-2xl font-medium mb-2">2. Send via Gmail API</h3>
                    <p className="text-sm text-muted-foreground mb-6">Send personalized certificates with custom subjects and bodies.</p>
                    
                    {!session ? (
                        <div className="flex flex-col items-center gap-4 py-16">
                            <p className="text-muted-foreground text-center max-w-sm">Log in with Google to securely authorize the platform to send emails on your behalf.</p>
                            <Button onClick={() => signIn("google")} size="lg" className="w-1/2">Sign in with Google</Button>
                        </div>
                    ) : (
                        <div className="flex flex-col space-y-5">
                            <div className="flex justify-between items-center text-sm bg-secondary p-3 rounded-lg border">
                                <span>Signed in as <strong className="text-green-600 font-semibold">{session.user?.email}</strong></span>
                                <Button variant="outline" size="sm" onClick={() => signOut()}>Sign out</Button>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm mb-1 font-medium">Email Column</label>
                                    {previewCols.length > 0 ? (
                                        <select value={emailCol} onChange={(e) => setEmailCol(e.target.value)} className="flex h-10 w-full rounded-md border border-input bg-secondary px-3 py-2 text-sm ring-offset-background disabled:cursor-not-allowed disabled:opacity-50">
                                            <option value="" disabled>-- Select Column --</option>
                                            {previewCols.map(col => <option key={col.field} value={col.field}>{col.field}</option>)}
                                        </select>
                                    ) : (
                                        <Input value={emailCol} onChange={(e) => setEmailCol(e.target.value)} placeholder="Load preview first" className="bg-secondary" />
                                    )}
                                </div>
                                <div>
                                    <label className="block text-sm mb-1 font-medium">Name Column</label>
                                    {previewCols.length > 0 ? (
                                        <select value={nameCol} onChange={(e) => setNameCol(e.target.value)} className="flex h-10 w-full rounded-md border border-input bg-secondary px-3 py-2 text-sm ring-offset-background disabled:cursor-not-allowed disabled:opacity-50">
                                            <option value="" disabled>-- Select Column --</option>
                                            {previewCols.map(col => <option key={col.field} value={col.field}>{col.field}</option>)}
                                        </select>
                                    ) : (
                                        <Input value={nameCol} onChange={(e) => setNameCol(e.target.value)} placeholder="Load preview first" className="bg-secondary" />
                                    )}
                                </div>
                            </div>
                            
                            <hr className="my-1 border-slate-600 border-opacity-20" />

                            <div>
                                <label className="block text-sm mb-1 font-medium">Subject Line</label>
                                <Input value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} className="bg-secondary" />
                            </div>
                            <div>
                                <label className="block text-sm mb-1 font-medium">CC Emails (optional)</label>
                                <Input value={emailCC} onChange={(e) => setEmailCC(e.target.value)} placeholder="foo@example.com, bar@example.com" className="bg-secondary" />
                            </div>
                            <div>
                                <label className="block text-sm mb-1 font-medium">Email Body</label>
                                <p className="text-xs text-muted-foreground mb-2">Use <span className="text-primary font-mono bg-secondary px-1 rounded">{"{Name}"}</span> to dynamically evaluate the participant's name.</p>
                                <textarea 
                                    rows={8} 
                                    value={emailBody} 
                                    className="flex w-full rounded-md border border-input bg-secondary px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    onChange={(e) => setEmailBody(e.target.value)} 
                                />
                            </div>

                            <Button onClick={handleSendEmails} className="w-full mt-4" size="lg">🚀 Start Live Mail Queue</Button>
                            
                            {emailStatus && (
                                <div className="mt-4 p-4 border rounded-lg text-sm bg-accent overflow-hidden text-ellipsis whitespace-nowrap align-middle flex items-center gap-3">
                                    <span className="animate-spin h-3 w-3 inline-block rounded-full bg-blue-500"></span>
                                    <span><span className="font-semibold text-primary">Live Status:</span> {emailStatus}</span>
                                </div>
                            )}

                            {report.length > 0 && (
                                <div className="mt-4 p-4 border rounded-lg overflow-auto max-h-72 text-sm bg-background">
                                    <h4 className="font-semibold mb-3 sticky top-0 bg-background pb-1 border-b">Live Delivery Log ({report.length} processed)</h4>
                                    <ul className="space-y-2">
                                        {report.slice().reverse().map((r: any, idx: number) => (
                                            <li key={idx} className="flex justify-between border-b border-border pb-2 last:border-0 last:pb-0 items-center">
                                                <span className="opacity-90">{r.name} ({r.email})</span>
                                                <span className={`${r.status === 'success' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'} text-xs px-2 py-1 rounded font-medium`}>
                                                    {r.status.toUpperCase()} {r.error ? `(${r.error})` : ''}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* GitHub Section */}
                <div className="border p-6 rounded-lg shadow-sm bg-card h-fit">
                    <h3 className="text-2xl font-medium mb-2">3. Deploy to GitHub Pages</h3>
                    <p className="text-sm text-muted-foreground mb-6">Push the generated verification website directly to a GitHub repository branch.</p>
                    <div className="flex flex-col space-y-5">
                        <div>
                            <label className="block text-sm mb-1 font-medium">Personal Access Token (PAT)</label>
                            <Input type="password" value={githubToken} onChange={(e) => setGithubToken(e.target.value)} placeholder="ghp_XXXXXXXXXXXXXXXXXXXX" className="bg-secondary" />
                            <details className="mt-2 text-xs text-muted-foreground bg-secondary/50 p-2 rounded border">
                                <summary className="cursor-pointer font-medium hover:text-foreground">Need help creating a secure GitHub PAT?</summary>
                                <div className="mt-2 space-y-2 p-1">
                                    <p>1. Go to your GitHub <strong>Settings</strong> &rarr; <strong>Developer settings</strong> &rarr; <strong>Personal access tokens</strong> &rarr; <strong>Fine-grained tokens</strong>.</p>
                                    <p>2. Click <strong>Generate new token</strong>.</p>
                                    <p>3. Under <strong>Repository access</strong>, select <strong>Only select repositories</strong> and pick your target repository.</p>
                                    <p>4. Under <strong>Permissions</strong> &rarr; <strong>Repository permissions</strong>, find <strong>Contents</strong> and set it to <strong>Read and Write</strong>.</p>
                                    <p>5. Generate and paste the token here.</p>
                                </div>
                            </details>
                        </div>
                        <div>
                            <label className="block text-sm mb-1 font-medium">Repository Owner</label>
                            <Input value={repoOwner} onChange={(e) => setRepoOwner(e.target.value)} placeholder="e.g. CBITOSC" className="bg-secondary" />
                        </div>
                        <div>
                            <label className="block text-sm mb-1 font-medium">Repository Name</label>
                            <Input value={repoName} onChange={(e) => setRepoName(e.target.value)} placeholder="e.g. verify24" className="bg-secondary" />
                        </div>
                        <Button onClick={handleDeploy} variant="outline" className="w-full mt-4" size="lg">Push HTML Docs</Button>
                        {deployStatus && <p className="text-sm font-medium mt-2 p-3 bg-secondary rounded">{deployStatus}</p>}
                    </div>
                </div>
            </div>
        </div>
    );
}
