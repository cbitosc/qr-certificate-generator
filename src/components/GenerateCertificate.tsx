"use client";

import { useEffect, useRef, useState } from "react";
import { Stage, Layer, Image, Text } from "react-konva";
import useImage from "use-image";
import { NextPage } from "next";
import { AgGridReact } from "ag-grid-react";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import * as XLSX from "xlsx";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-quartz.css";
import { ColDef } from "ag-grid-community";
import { useTheme } from "next-themes";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { cn } from "@/lib/utils";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { Calendar } from "./ui/calendar";
import Link from "next/link";

const GenerateCertificate = () => {
    const [verifiable, setVerifiable] = useState(true);
    const [baseUrl, setBaseUrl] = useState("");
    const [title, setTitle] = useState("");
    const [templateFile, setTemplateFile] = useState<File | null>(null);
    const [excelFile, setExcelFile] = useState<File | null>(null);
    // overlays represent each piece of dynamic text that can be positioned individually
    type Overlay = {
        id: number;
        textFormat: string;
        position: { x: number; y: number };
        size: number;
        color: string;
        fontFamily?: string;
        fontFile?: File | null;
    };

    const [overlays, setOverlays] = useState<Overlay[]>([
        {
            id: 1,
            textFormat: "",
            position: { x: 100, y: 100 },
            size: 90,
            color: "#000000",
        },
    ]);
    const overlayRefs = useRef<{ [key: number]: any }>({});

    const [svgFile, setSvgFile] = useState<File | null>(null);
    const [outputDir, setOutputDir] = useState("");
    const [codeSerial, setCodeSerial] = useState("RFBM");
    const [codesStartNumber, setCodesStartNumber] = useState(0);
    const [date, setDate] = useState<Date>();
    const [columnDefs, setColumnDefs] = useState<ColDef[]>([]);
    const [rowData, setRowData] = useState<any[]>([]);
    const [outputFormat, setOutputFormat] = useState("png");
    const { resolvedTheme } = useTheme();

    const [isGenerating, setIsGenerating] = useState(false);
    const [genStatus, setGenStatus] = useState<any>(null);
    const [genCompleted, setGenCompleted] = useState(false);
    const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Cleanup polling interval on unmount to prevent state updates on unmounted component
    useEffect(() => {
        return () => {
            if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current);
            }
        };
    }, []);

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            setExcelFile(file);
            const reader = new FileReader();
            reader.onload = (e) => {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: "array" });
                const sheetName = workbook.SheetNames[0];
                const sheet = workbook.Sheets[sheetName];
                const parsedData = XLSX.utils.sheet_to_json(sheet, {
                    header: 1,
                });

                const filteredData = parsedData.filter((row: any) =>
                    row.some(
                        (cell: any) =>
                            cell !== null && cell !== undefined && cell !== ""
                    )
                );

                const headers = filteredData[0] as string[];
                const dynamicColumnDefs = headers.map((header: string) => ({
                    field: header,
                    editable: true,
                    cellEditor: "agTextCellEditor",
                }));
                setColumnDefs(dynamicColumnDefs);

                const processedData = filteredData.slice(1).map((row: any) => {
                    const rowObj: any = {};
                    headers.forEach((header: string, index: number) => {
                        rowObj[header] = row[index];
                    });
                    return rowObj;
                });
                setRowData(processedData);
            };
            reader.readAsArrayBuffer(file);
        }
    };

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (imageSize) {
            // prepare overlay-specific data
            const overlaysDesign = overlays.map((ov) => {
                const ref = overlayRefs.current[ov.id];
                const rect = ref?.getClientRect();
                const centerX = ov.position.x / scale + (rect ? rect.width / scale / 2 : 0);
                const centerY = ov.position.y / scale;
                return {
                    textFormat: ov.textFormat,
                    textSize: ov.size,
                    textColor: ov.color,
                    textCenterCoordinates: { x: centerX, y: centerY },
                };
            });

            const designData = {
                imageSize,
                qrSize,
                qrPosition: {
                    x: qrPosition.x / scale,
                    y: qrPosition.y / scale,
                },
                overlays: overlaysDesign,
            };

            // Merge designData into form data
            const formData = new FormData();
            formData.append("verifiable", verifiable.toString());
            if (verifiable) {
                formData.append("base_url", baseUrl);
            }
            formData.append("title", title);
            formData.append("template", templateFile as Blob);
            // we won't send a single overlay_format anymore; backend reads from designData.overlays
            if (verifiable && svgFile) {
                formData.append("svg_template", svgFile as Blob);
            }

            // Create a new Excel file from the potentially edited rowData
            if (rowData.length === 0) {
                alert("Please ensure the Excel data is loaded and not empty.");
                return;
            }
            const worksheet = XLSX.utils.json_to_sheet(rowData);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Data");
            const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
            const excelBlob = new Blob([excelBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
            formData.append("excel", excelBlob, "data.xlsx");

            formData.append("output_directory", outputDir);
            formData.append("code_serial", codeSerial);
            formData.append("codes_start_number", codesStartNumber.toString());
            formData.append("design_data", JSON.stringify(designData));
            if (date) {
                formData.append("date", date.toDateString());
            }
            formData.append("output_format", outputFormat);

            overlays.forEach((ov, i) => {
                if (ov.fontFile) {
                    formData.append("fonts", ov.fontFile);
                } else {
                    formData.append("fonts", new Blob([""], { type: "application/octet-stream" }), `empty_${i}.ttf`);
                }
            });

            try {
                const response = await fetch("/api/generate-certificates", {
                    method: "POST",
                    body: formData,
                });

                if (!response.ok) {
                    const text = await response.text();
                    console.error("Server returned non-OK status", response.status, text);
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                setIsGenerating(true);
                setGenCompleted(false);
                setGenStatus(null);
                sessionStorage.setItem("latestOutputDir", outputDir);

                // Clear any existing poll before starting a new one
                if (pollIntervalRef.current) {
                    clearInterval(pollIntervalRef.current);
                }

                pollIntervalRef.current = setInterval(async () => {
                    try {
                        const res = await fetch(`/api/generation-status?output_directory=${encodeURIComponent(outputDir)}`);
                        const data = await res.json();
                        setGenStatus(data);
                        if (data.status === "completed" || data.status === "failed") {
                            clearInterval(pollIntervalRef.current!);
                            pollIntervalRef.current = null;
                            setIsGenerating(false);
                            if (data.status === "completed") {
                                setGenCompleted(true);
                            }
                        }
                    } catch(e) {
                        console.error(e);
                        clearInterval(pollIntervalRef.current!);
                        pollIntervalRef.current = null;
                        setIsGenerating(false);
                    }
                }, 2000);

            } catch (error) {
                console.error(error);
                alert("An error occurred while generating certificates. See console for details.");
            }
        } else {
            alert("Please complete the design.");
        }
    };

    // State and logic for the CertificateDesigner component
    const [templateImage, setTemplateImage] = useState<string | null>(null);
    // the single-text-specific states were removed; overlay info is used instead
    const [image, setImage] = useState<HTMLImageElement | null>(null);
    const [qrImage] = useImage("/qr_code.png");
    const [imageSize, setImageSize] = useState<{
        width: number;
        height: number;
    } | null>(null);
    const [qrPosition, setQrPosition] = useState({ x: 200, y: 200 });
    const [qrSize, setQrSize] = useState(400);
    const [loadedImage] = useImage(templateImage || "");

    useEffect(() => {
        if (loadedImage) {
            setImage(loadedImage);
            setImageSize({
                width: loadedImage.width,
                height: loadedImage.height,
            });
        }
    }, [loadedImage]);

    const handleTemplateUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setTemplateFile(e.target.files?.[0] || null);
            const reader = new FileReader();
            reader.onloadend = () => {
                setTemplateImage(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const canvasWidth = window.innerWidth * 0.8; // 80% of the window width
    const canvasHeight = window.innerHeight * 0.8; // 80% of the window height
    const scale = Math.min(
        canvasWidth / (imageSize?.width || 1),
        canvasHeight / (imageSize?.height || 1)
    );

    return (
        <div className="flex flex-col px-8 py-8 text-foreground">
            <h1 className="text-primary text-4xl font-semibold">
                Generate QR Certificates
            </h1>
            <Separator className="my-8" />
            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="form-group">
                    <label htmlFor="title">Title</label>
                    <Input
                        type="text"
                        id="title"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="form-control"
                        required
                    />
                </div>
                <div className="form-group flex items-center space-x-3">
                    <input
                        type="checkbox"
                        id="verifiable"
                        checked={verifiable}
                        onChange={(e) => setVerifiable(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300"
                    />
                    <label htmlFor="verifiable" className="text-sm font-medium">
                        Make certificates verifiable (includes QR code)
                    </label>
                </div>
                {verifiable && (
                <div className="form-group">
                    <label htmlFor="baseUrl">Base URL:</label>
                    <Input
                        type="text"
                        id="baseUrl"
                        value={baseUrl}
                        onChange={(e) => setBaseUrl(e.target.value)}
                        className="form-control"
                        required
                    />
                </div>
                )}
                <div className="form-group">
                    <label htmlFor="excel">Upload Excel File (XLSX):</label>
                    <Input
                        type="file"
                        id="excel"
                        onChange={handleFileUpload}
                        className="form-control"
                        accept=".xlsx"
                        required
                    />
                </div>
                <div
                    className={`w-full h-96 ${
                        resolvedTheme == "dark"
                            ? "ag-theme-quartz-dark"
                            : "ag-theme-quartz"
                    }`}
                >
                    <AgGridReact
                        rowData={rowData}
                        columnDefs={columnDefs}
                        defaultColDef={{ flex: 1 }}
                        domLayout="normal"
                    />
                </div>
                <div className="form-group">
                    <label className="block mb-2">Dynamic Text Overlays:</label>
                    {overlays.map((ov, idx) => (
                        <div key={ov.id} className="border p-2 mb-2">
                            <div className="flex justify-between items-center">
                                <strong>Overlay {idx + 1}</strong>
                                <Button
                                    type="button"
                                    variant="destructive"
                                    onClick={() => {
                                        setOverlays(overlays.filter((o) => o.id !== ov.id));
                                    }}
                                    size="sm"
                                >
                                    Remove
                                </Button>
                            </div>
                            <div className="flex flex-col space-y-4 mt-2">
                                <div className="flex space-x-4">
                                    <div className="flex-1">
                                        <label>Format:</label>
                                        <Input
                                            type="text"
                                            value={ov.textFormat}
                                            onChange={(e) => {
                                                const updated = [...overlays];
                                                updated[idx].textFormat = e.target.value;
                                                setOverlays(updated);
                                            }}
                                            placeholder="{Name} of {Department} Department"
                                        />
                                    </div>
                                    <div className="flex-1">
                                        <label>Font Size:</label>
                                        <Input
                                            type="number"
                                            value={ov.size}
                                            onChange={(e) => {
                                                const updated = [...overlays];
                                                updated[idx].size = Number(e.target.value);
                                                setOverlays(updated);
                                            }}
                                        />
                                    </div>
                                    <div className="flex-1">
                                        <label>Color:</label>
                                        <div className="flex items-center space-x-2">
                                            <Input
                                                type="color"
                                                value={ov.color}
                                                onChange={(e) => {
                                                    const updated = [...overlays];
                                                    updated[idx].color = e.target.value;
                                                    setOverlays(updated);
                                                }}
                                                className="w-12 h-10 p-1 cursor-pointer"
                                            />
                                            <Input
                                                type="text"
                                                value={ov.color}
                                                onChange={(e) => {
                                                    const updated = [...overlays];
                                                    updated[idx].color = e.target.value;
                                                    setOverlays(updated);
                                                }}
                                                className="uppercase"
                                            />
                                        </div>
                                    </div>
                                </div>
                                <div className="flex space-x-4 items-end">
                                    <div className="flex-1">
                                        <label>Custom Font (.ttf):</label>
                                        <Input
                                            type="file"
                                            accept=".ttf,.otf"
                                            onChange={async (e) => {
                                                const file = e.target.files?.[0];
                                                if (file) {
                                                    try {
                                                        const fontUrl = URL.createObjectURL(file);
                                                        const fontName = `CustomFont_${ov.id}_${Date.now()}`;
                                                        const font = new FontFace(fontName, `url(${fontUrl})`);
                                                        await font.load();
                                                        // Revoke the blob URL now that the font is loaded into memory
                                                        URL.revokeObjectURL(fontUrl);
                                                        document.fonts.add(font);
                                                        const updated = [...overlays];
                                                        updated[idx].fontFamily = fontName;
                                                        updated[idx].fontFile = file;
                                                        setOverlays(updated);
                                                    } catch (err) {
                                                        console.error("Font loading error", err);
                                                        alert("Failed to load font visually. It will still be sent to the server.");
                                                        const updated = [...overlays];
                                                        updated[idx].fontFile = file;
                                                        setOverlays(updated);
                                                    }
                                                }
                                            }}
                                        />
                                    </div>
                                    <div>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() => {
                                                if (imageSize) {
                                                    const ref = overlayRefs.current[ov.id];
                                                    const rect = ref?.getClientRect();
                                                    const textWidthRaw = rect ? rect.width / scale : 0;
                                                    const newX = (imageSize.width / 2 - textWidthRaw / 2) * scale;
                                                    
                                                    const updated = [...overlays];
                                                    updated[idx].position = { ...updated[idx].position, x: newX };
                                                    setOverlays(updated);
                                                } else {
                                                    alert("Please upload a template image first to center the text.");
                                                }
                                            }}
                                        >
                                            Center Horizontally
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                    <Button
                        type="button"
                        onClick={() => {
                            const maxId = overlays.reduce(
                                (m, o) => Math.max(m, o.id),
                                0
                            );
                            setOverlays([
                                ...overlays,
                                {
                                    id: maxId + 1,
                                    textFormat: "",
                                    position: { x: 50, y: 50 },
                                    size: 90,
                                    color: "#000000",
                                },
                            ]);
                        }}
                    >
                        + Add Overlay
                    </Button>
                </div>
                <div className="mt-10">
                    <label htmlFor="template">
                        Upload Certificate Template (PNG/JPG):
                    </label>
                    <Input
                        type="file"
                        onChange={handleTemplateUpload}
                        id="template"
                        className="form-control"
                        accept=".png, .jpg, .jpeg"
                        required
                    />
                    {image != null && (
                        <div>
                            <p className=" mt-4">
                                Drag to set the positions of Text and QR code
                            </p>
                            <Stage
                                width={canvasWidth}
                                height={canvasHeight}
                                scaleX={scale}
                                scaleY={scale}
                                draggable
                                className="mt-4"
                            >
                                <Layer>
                                    {image && (
                                        <Image
                                            image={image}
                                            width={imageSize?.width || 800}
                                            height={imageSize?.height || 600}
                                        />
                                    )}
                                    {overlays.map((ov) => (
                                        <Text
                                            key={ov.id}
                                            text={ov.textFormat}
                                            fontSize={ov.size}
                                            fill={ov.color}
                                            fontFamily={ov.fontFamily || "Arial"}
                                            x={ov.position.x / scale}
                                            y={ov.position.y / scale}
                                            ref={(node) => {
                                                if (node) overlayRefs.current[ov.id] = node;
                                            }}
                                            draggable
                                            align="center"
                                            verticalAlign="middle"
                                            onDragEnd={(e) => {
                                                const { x, y } = e.target.attrs;
                                                setOverlays((prev) =>
                                                    prev.map((o) =>
                                                        o.id === ov.id
                                                            ? {
                                                                  ...o,
                                                                  position: {
                                                                      x: x * scale,
                                                                      y: y * scale,
                                                                  },
                                                              }
                                                            : o
                                                    )
                                                );
                                            }}
                                        />
                                    ))}
                                    {verifiable && (
                                    <Image
                                        image={qrImage as HTMLImageElement}
                                        width={qrSize} // Fixed size for QR code
                                        height={qrSize}
                                        x={qrPosition.x / scale}
                                        y={qrPosition.y / scale}
                                        draggable
                                        onDragEnd={(e) => {
                                            const { x, y } = e.target.attrs;
                                            setQrPosition({
                                                x: x * scale,
                                                y: y * scale,
                                            });
                                        }}
                                    />
                                    )}
                                </Layer>
                            </Stage>
                            {imageSize != null && (
                                <div className="mt-4 space-y-4 w-full">
                                    <div className="flex space-x-4 w-full gap-4">
                                        {verifiable && (
                                            <div className="flex-1 flex flex-col">
                                                <label htmlFor="qrSize">
                                                    QR Code Size:
                                                </label>
                                                <Input
                                                    type="text"
                                                    id="qrSize"
                                                    value={qrSize}
                                                    onChange={(e) =>
                                                        setQrSize(
                                                            Number(e.target.value)
                                                        )
                                                    }
                                                />
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex space-x-4 w-full gap-4">
                                        <div className="flex-1">
                                            <label htmlFor="qrX">
                                                QR Code X Coordinate (Left):
                                            </label>
                                            <Input
                                                type="text"
                                                id="qrX"
                                                value={qrPosition.x / scale}
                                                onChange={(e) =>
                                                    setQrPosition({
                                                        ...qrPosition,
                                                        x:
                                                            Number(
                                                                e.target.value
                                                            ) * scale,
                                                    })
                                                }
                                            />
                                        </div>
                                        <div className="flex-1">
                                            <label htmlFor="qrY">
                                                QR Code Y Coordinate (Top):
                                            </label>
                                            <Input
                                                type="text"
                                                id="qrY"
                                                value={qrPosition.y / scale}
                                                onChange={(e) =>
                                                    setQrPosition({
                                                        ...qrPosition,
                                                        y:
                                                            Number(
                                                                e.target.value
                                                            ) * scale,
                                                    })
                                                }
                                            />
                                        </div>
                                        <div className="flex-1 flex flex-col">
                                            <label htmlFor="textY">
                                                Horizontal
                                            </label>
                                            <Button
                                                type="button"
                                                variant={"outline"}
                                                onClick={() => {
                                                    setQrPosition({
                                                        ...qrPosition,
                                                        x:
                                                            Number(
                                                                (imageSize?.width -
                                                                    qrSize) /
                                                                    2
                                                            ) * scale,
                                                    });
                                                }}
                                            >
                                                Center
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
                {verifiable && (
                <div className="form-group">
                    <label htmlFor="svg">
                        Upload SVG File (SVG):{" "}
                        <Link
                            href={
                                "https://pixelied.com/convert/png-converter/png-to-svg"
                            }
                            target="blank"
                            className=" text-blue-600 hover:underline underline-offset-2 "
                        >
                            Convert png to svg
                        </Link>
                    </label>
                    <Input
                        type="file"
                        id="svg"
                        onChange={(e) => {
                            setSvgFile(e?.target?.files?.[0] as File);
                        }}
                        className="form-control"
                        accept=".svg"
                    />
                </div>
                )}
                <div className="form-group flex items-center space-x-6">
                    <div>
                        <label className="block mb-2 font-medium">Output Format:</label>
                        <div className="flex items-center space-x-4">
                            <label className="flex items-center space-x-2">
                                <input
                                    type="radio"
                                    value="png"
                                    checked={outputFormat === "png"}
                                    onChange={(e) => setOutputFormat(e.target.value)}
                                    className="h-4 w-4"
                                />
                                <span>PNG</span>
                            </label>
                            <label className="flex items-center space-x-2">
                                <input
                                    type="radio"
                                    value="pdf"
                                    checked={outputFormat === "pdf"}
                                    onChange={(e) => setOutputFormat(e.target.value)}
                                    className="h-4 w-4"
                                />
                                <span>PDF</span>
                            </label>
                        </div>
                    </div>
                </div>
                <div className="form-group">
                    <label htmlFor="outputDir">Output Directory:</label>
                    <Input
                        type="text"
                        id="outputDir"
                        value={outputDir}
                        onChange={(e) => setOutputDir(e.target.value)}
                        className="form-control"
                        required
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="codeSerial">Code Serial:</label>
                    <Input
                        type="text"
                        id="codeSerial"
                        value={codeSerial}
                        onChange={(e) => setCodeSerial(e.target.value)}
                        className="form-control"
                        required
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="codesStartNumber">
                        Codes Start Number:
                    </label>
                    <Input
                        type="text"
                        id="codesStartNumber"
                        value={codesStartNumber}
                        onChange={(e) =>
                            setCodesStartNumber(Number(e.target.value))
                        }
                        className="form-control"
                        required
                    />
                </div>
                <div className="form-group flex flex-col">
                    <label htmlFor="date">Certificate Generation Date:</label>
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button
                                variant={"outline"}
                                className={cn(
                                    " justify-start text-left font-normal",
                                    !date && "text-muted-foreground"
                                )}
                            >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {date ? (
                                    format(date, "PPP")
                                ) : (
                                    <span>Pick a date</span>
                                )}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                            <Calendar
                                mode="single"
                                selected={date}
                                onSelect={setDate}
                                initialFocus
                            />
                        </PopoverContent>
                    </Popover>
                </div>
                <div className="flex flex-col gap-4">
                    <Button type="submit" className="btn btn-primary w-fit" disabled={isGenerating}>
                        {isGenerating ? "Generating..." : "Generate Certificates"}
                    </Button>

                    {isGenerating && genStatus && (
                        <div className="p-4 border rounded-lg text-sm bg-accent flex items-center gap-3 w-fit">
                            <span className="animate-spin h-3 w-3 inline-block rounded-full bg-blue-500"></span>
                            <span>
                                Generating... {genStatus.current} / {genStatus.total} completed.
                            </span>
                        </div>
                    )}
                    {genCompleted && (
                        <div className="p-4 border rounded-lg text-sm bg-green-100 dark:bg-green-900 border-green-500 flex flex-col gap-3 w-fit">
                            <span className="text-green-700 dark:text-green-300 font-semibold">Generation Completed Successfully!</span>
                            <Link href="/distribute">
                                <Button variant="default">Go to Distribute Page</Button>
                            </Link>
                        </div>
                    )}
                    {genStatus?.status === 'failed' && (
                        <div className="p-4 border rounded-lg text-sm bg-red-100 dark:bg-red-900 border-red-500 w-fit">
                            <span className="text-red-700 dark:text-red-300 font-semibold">Generation failed: {genStatus.error}</span>
                        </div>
                    )}
                </div>
            </form>
        </div>
    );
};

export default GenerateCertificate;
