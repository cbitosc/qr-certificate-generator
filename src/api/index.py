from fastapi import FastAPI, File, UploadFile, Form, BackgroundTasks, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import os
import qrcode
import pandas as pd
from PIL import Image, ImageDraw, ImageFont
import json
from typing import Optional
from lxml import etree
from urllib.parse import urlparse

app = FastAPI()

base_dir = os.path.dirname(os.path.abspath(__file__))

class Coordinates(BaseModel):
    x: float
    y: float

class ImageSize(BaseModel):
    width: float
    height: float

class DesignData(BaseModel):
    textSize: int
    textColor: str
    imageSize: ImageSize
    textCenterCoordinates: Coordinates
    qrSize: float
    qrPosition: Coordinates

class CertificateData(BaseModel):
    base_url: str
    output_directory: str
    code_serial: str
    codes_start_number: int
    json_file_name: str
    json_directory: str
    design_data: DesignData
    title: str

def modify_svg(svg_content: str, name: str, qr_x: int, qr_y: int, name_x: int, name_y: int, text_color: str, text_height: int, png_dimensions: tuple) -> str:
    parser = etree.XMLParser(remove_blank_text=True, huge_tree=True)
    svg_tree = etree.fromstring(svg_content, parser)

    viewbox = svg_tree.attrib.get("viewBox", "")
    if viewbox:
        viewbox_values = [float(val) for val in viewbox.split()]
        svg_width = viewbox_values[2] - viewbox_values[0]
        svg_height = viewbox_values[3] - viewbox_values[1]
    else:
        svg_width = 841.92
        svg_height = 595.5

    png_width, png_height = png_dimensions

    scale_x = svg_width / png_width
    scale_y = svg_height / png_height

    svg_tree.attrib['preserveAspectRatio'] = "xMidYMid meet"
    svg_tree.attrib['style'] = "width: 100%; height: auto"
    svg_tree.attrib['id'] = "certificate"
    svg_tree.attrib['class'] = "hidden"

    text_y_position = (name_y + text_height / 2) * scale_y
    name_element = etree.Element("text", attrib={
        "x": str(name_x * scale_x),
        "y": str(text_y_position),
        "fill": text_color,
        "text-anchor": "middle",
        "alignment-baseline": "middle",
        "id": "name-element"
    })
    name_element.text = name

    foreign_object = etree.Element("foreignObject", attrib={
        "x": str(qr_x * scale_x),
        "y": str(qr_y * scale_y),
        "width": "100%",
        "height": "100%"
    })
    qr_div = etree.Element("div", attrib={"id": "qr-container", "class": "image-container"})
    foreign_object.append(qr_div)

    svg_tree.append(name_element)
    svg_tree.append(foreign_object)

    return (scale_x, scale_y, etree.tostring(svg_tree, pretty_print=True, encoding="unicode"))

def generate_certificates_task(
    base_url: str,
    output_directory: str,
    code_serial: str,
    codes_start_number: int,
    design_data_dict: dict,
    template_content: bytes,
    excel_content: bytes,
    svg_template_content: Optional[bytes],
    date: str,
    overlay_format:str,
    title: str
):
    design_data_obj = DesignData(**design_data_dict)
    
    template_path = os.path.join(base_dir, 'static', 'templates', 'template.png')
    svg_template_path = os.path.join(base_dir, 'static', 'templates', 'template.svg')
    excel_path = os.path.join(base_dir, 'static', 'data', 'data.xlsx')
    qr_path = os.path.join(base_dir, 'static', 'qr_code.png')
    output_directory_path = os.path.join(base_dir, output_directory)
    output_certificates_path = os.path.join(base_dir, output_directory, "certificates")
    base_certificates_path = output_certificates_path
    output_docs_path = os.path.join(base_dir, output_directory, "docs" )
    os.makedirs(output_directory_path, exist_ok=True)
    os.makedirs(output_certificates_path, exist_ok=True)
    os.makedirs(output_docs_path, exist_ok=True)
    os.makedirs(os.path.join(base_dir, 'static', 'templates'), exist_ok=True)
    os.makedirs(os.path.join(base_dir, 'static', 'data'), exist_ok=True)

    with open(template_path, "wb") as f:
        f.write(template_content)
    
    with open(excel_path, "wb") as f:
        f.write(excel_content)
    
    if svg_template_content:
        with open(svg_template_path, "wb") as f:
            f.write(svg_template_content)
    
    certificate_template = Image.open(template_path)
    df = pd.read_excel(excel_path)

    all_certificates_data = []
    
    def generate_qr_code(data, qr_filename):
        qr = qrcode.QRCode(
            version=8,
            error_correction=qrcode.constants.ERROR_CORRECT_H,
            box_size=40,
            border=0,
        )
        qr.add_data(data)
        qr.make(fit=True)
        img = qr.make_image(fill_color="black", back_color="white")
        img.save(qr_filename)

    def overlay_qr_code(certificate, text, qr_code, text_position, qr_position, output_filename):
        draw = ImageDraw.Draw(certificate)
        font_path = os.path.join(base_dir, 'static', 'fonts', 'bask-reg.ttf')
        text_height = int(round(design_data_obj.textSize))
        font = ImageFont.truetype(font_path, text_height)
        text_width = font.getlength(text)
        text_x = text_position[0] - text_width // 2
        text_y = text_position[1]
        draw.text((text_x, text_y), text, fill=design_data_obj.textColor, font=font)
        qr_size = int(round(design_data_obj.qrSize))
        qr_code = qr_code.resize((qr_size, qr_size))
        qr_alpha = qr_code.convert("RGBA").split()[3]
        qr_overlay = Image.new("RGBA", certificate.size, (0, 0, 0, 0))
        qr_overlay.paste(qr_code, qr_position, qr_alpha)
        result = Image.alpha_composite(certificate.convert("RGBA"), qr_overlay)
        result.save(output_filename)
    if svg_template_content:
        svg_content = svg_template_content.decode('utf-8')
    else:
        svg_content = ""
    for index, row in df.iterrows():
        # if not pd.isna(row['Team Number']):
        #     output_certificates_path = f"{base_certificates_path}/Team-{int(row['Team Number'])}/"
        #     os.makedirs(output_certificates_path, exist_ok=True)   
        name = row['Name']
        fname = ' '.join(''.join((word[i].upper() if (i == 0 or (i < len(word) - 1 and word[i-1] == '.')) else char.lower()) for i, char in enumerate(word)) for word in name.split())
        code = fname.lower().replace(" ", "").replace(".", "") + code_serial + str(index + codes_start_number).zfill(4)
        qr_data = base_url + code
        qr_filename = qr_path
        generate_qr_code(qr_data, qr_filename)
        qr_code = Image.open(qr_filename)
        if "{Name}" in overlay_format:
            overlay_format_modified = overlay_format.replace("{Name}", "{fname}")
        else:
            overlay_format_modified = overlay_format
        row_dict = row.to_dict()
        row_dict['fname'] = fname
        try:
            overlay_text = overlay_format_modified.format(**row_dict)
        except KeyError as e:
            raise HTTPException(status_code=400, detail=f"Column '{e.args[0]}' not found in Excel sheet")
        text_position = (int(round(design_data_obj.textCenterCoordinates.x)), int(round(design_data_obj.textCenterCoordinates.y)))
        qr_position = (int(round(design_data_obj.qrPosition.x)), int(round(design_data_obj.qrPosition.y)))
        output_filename = os.path.join(output_certificates_path, f"{fname}.png")
        overlay_qr_code(certificate_template.copy(), overlay_text, qr_code, text_position, qr_position, output_filename)
        print(f"Certificate for {name} generated")
        scaleX, scaleY, modified_svg = modify_svg(svg_content, overlay_text, qr_position[0], qr_position[1], text_position[0], text_position[1], design_data_obj.textColor, design_data_obj.textSize, (certificate_template.width, certificate_template.height))
        certificate_data = {
            "code": code,
            "holder": overlay_text,
            # "svg": modified_svg
        }
        all_certificates_data.append(certificate_data)

    

    if svg_content:
        scaleX, scaleY, modified_svg = modify_svg(svg_content, overlay_text, qr_position[0], qr_position[1], text_position[0], text_position[1], design_data_obj.textColor, design_data_obj.textSize, (certificate_template.width, certificate_template.height))

        parsed_url = urlparse(base_url)
        path = parsed_url.path
        path = path.rstrip('/')
        segments = path.split('/')
        folder_name = segments[-1] if len(segments) > 0 else None
        print(folder_name)

        html_dir = os.path.join(output_docs_path, folder_name)
        os.makedirs(html_dir, exist_ok=True)

        with open(os.path.join(html_dir, "index.html"), "w") as html_file:
            html_file.write(f'''
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{title}</title>
<link rel="stylesheet" href="style.css">
</head>
<body>
<div class="container">
    <div class="container" id="general-header">
        <p class="header">
            This is CBIT Open Source Community's certificate verification
            Website.
        </p>
        <p class="header">Enter the correct link to get the certificate</p>
    </div>

    <div class="container hidden" id="cert-header">
        <p class="header">
            This is an authentic certificate issued to
            <span id="header-name-element"></span> on {date}
        </p>
    </div>
    <div id="svg_id">
    {modified_svg}
    </div>
</div>
<script
    src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"
    integrity="sha512-CNgIRecGo7nphbeZ04Sc13ka07paqdeTu0WR1IM4kNcpmBAUSHSQX0FslNhTDadL4O5SAGapGt4FodqL8My0mA=="
    crossorigin="anonymous"
    referrerpolicy="no-referrer">
</script>
<script src="script.js"></script>
</body>
</html>
''')

        with open(os.path.join(html_dir, "script.js"), "w") as js_file:
            js_file.write(f'''
document.addEventListener("DOMContentLoaded", function () {{
const urlParams = new URLSearchParams(window.location.search);
const odysseyCode = urlParams.get("id");

fetch("data.json")
    .then((response) => response.json())
    .then((jsonData) => {{
        const matchingEntry = jsonData.find((entry) => entry.code === odysseyCode);

        if (matchingEntry) {{
            const generalHeader = document.getElementById("general-header");
            generalHeader.classList.add("hidden");

            const nameElement = document.getElementById("name-element");
            nameElement.textContent = `${{matchingEntry.holder}}`;

            const headerNameElement = document.getElementById("header-name-element");
            headerNameElement.textContent = `${{matchingEntry.holder}}`;

            const certHeader = document.getElementById("cert-header");
            const certificate = document.getElementById("certificate");


            certHeader.classList.remove("hidden");
            certificate.classList.remove("hidden");

            const qrContainer = document.getElementById("qr-container");

            const qr = new QRCode(qrContainer, {{
                text: "{base_url}" + matchingEntry.code,
                width: 384,
                height: 384,
                typeNumber: 8,
                correctLevel: QRCode.CorrectLevel.H,
                colorDark: "#000000",
                colorLight: "#ffffff"
            }});
        }} else {{
            console.error("No matching entry found for the provided code.");
        }}
    }})
    .catch((error) => console.error("Error loading JSON:", error));
}});
''')

        scaledQrSize = int(round(design_data_obj.qrSize)) * scaleX
        scaledFontSize = int(round(design_data_obj.textSize)) * scaleY

        with open(os.path.join(html_dir, "style.css"), "w") as css_file:
            css_file.write(f'''
body {{
    max-width: 100%;
}}

@font-face {{
    font-family: "Baskerville-old-face";
    src: url("/verify24/assests/fonts/BASKVILL.ttf") format("truetype");
}}

.baskvile {{
    font-family: "Baskerville-old-face", sans-serif;
}}

.container {{
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    max-width: screen;
}}
                        
#name-element {{
    font-size: {scaledFontSize}px;
}}

.header {{
    font-size: 1.6rem;
    font-weight: bold;
    line-height: 2rem;
}}

.hidden {{
    display: none;
}}

@media (max-width: 767px) {{
    .header {{
        font-size: 0.8rem;
        line-height: 1.2rem;
    }}
}}

.transform img {{
    width: 100%;
    max-width: {scaledQrSize}px;
    height: auto;
}}

.image-container img,
canvas {{
    width: 100%;
    max-width: {scaledQrSize}px;
    height: auto;
    display: block;
}}
''')

    with open(os.path.join(html_dir, "data.json"), 'w') as json_file:
        json.dump(all_certificates_data, json_file, indent=2)

@app.post("/api/generate-certificates")
async def generate_certificates(
    background_tasks: BackgroundTasks,
    base_url: str = Form(...),
    output_directory: str = Form(...),
    code_serial: str = Form(...),
    codes_start_number: int = Form(...),
    design_data: str = Form(...),
    overlay_format: str = Form(...),
    template: UploadFile = File(...),
    excel: UploadFile = File(...),
    date: str = Form(...),
    svg_template: Optional[UploadFile] = File(None),
    title: str = Form(...)
):
    design_data_dict = json.loads(design_data)

    template_content = await template.read()
    excel_content = await excel.read()

    svg_template_content = None
    if svg_template:
        svg_template_content = await svg_template.read()

    background_tasks.add_task(
        generate_certificates_task,
        base_url,
        output_directory,
        code_serial,
        codes_start_number,
        design_data_dict,
        template_content,
        excel_content,
        svg_template_content,
        date,
        overlay_format,
        title
    )
    
    return JSONResponse(content={"message": "Certificate generation is running in the background."})
