from jinja2 import Template
import re


def css_style(style_dict: dict) -> str:
    if not style_dict:
        return ""
    return ";".join([f"{k}:{v}" for k, v in style_dict.items()])


def normalize_font_size(v):
    if v is None:
        return "14px"

    v = str(v).strip()
    if v.endswith("px"):
        return v
    if v.isdigit():
        return f"{v}px"
    return "14px"


def extract_img_src(html_or_src: str) -> str:
    if not html_or_src:
        return ""
    if "<img" in html_or_src:
        m = re.search(r'src=["\'](.*?)["\']', html_or_src)
        if m:
            return m.group(1)
    return html_or_src


def render_element(el: dict, context: dict) -> str:
    etype = el.get("type")
    html_raw = el.get("html", "")

    # base positioning
    style = {
        "position": "absolute",
        "left": f"{el.get('left', 0)}px",
        "top": f"{el.get('top', 0)}px",
        "width": f"{el.get('width', 120)}px",
        "height": f"{el.get('height', 20)}px",
        "font-size": normalize_font_size(
            el.get("fontSize") or el.get("style", {}).get("fontSize")
        ),
        "overflow": "hidden",
        "box-sizing": "border-box",
    }

    # Merge safe user style
    user_style = el.get("style", {})
    for k, v in user_style.items():
        if k in ["left", "top", "width", "height", "position"]:
            continue
        style[k] = v

    css = css_style(style)

    # TEXT
    if etype in ("text", "heading", "variable"):
        try:
            content = Template(html_raw).render(**context)
        except Exception as e:
            print("Template error:", e)
            content = html_raw

        # sanitize: prevent nested absolute block
        content = content.strip()
        if content.startswith("<div") and content.endswith("</div>"):
            try:
                content = content[content.find(">")+1:content.rfind("</div>")]
            except:
                pass

        return f'<div class="element" style="{css}">{content}</div>'

    # IMAGE
    if etype == "image":
        raw_src = el.get("src") or html_raw
        if "<img" in html_raw:
            raw_src = extract_img_src(html_raw)

        try:
            final_src = Template(raw_src).render(**context)
        except:
            final_src = raw_src

        return f'<div class="element" style="{css}"><img src="{final_src}" style="width:100%;height:100%;object-fit:contain;" /></div>'

    # TABLE — JSON DATA
    if etype == "table":
        columns = el.get("columns")
        data_key = el.get("data")

        if columns and data_key:
            rows = context.get(data_key, [])
            if not isinstance(rows, list):
                rows = []

            html = '<table class="ae-table" border="1" style="border-collapse:collapse;width:100%;">'

            html += "<thead><tr>"
            for col in columns:
                html += f"<th>{col.get('header','')}</th>"
            html += "</tr></thead><tbody>"

            for i, row in enumerate(rows, start=1):
                html += "<tr>"
                for col in columns:
                    key = col.get("key")
                    if key == "index":
                        val = i
                    else:
                        val = row.get(key, "")
                    html += f"<td>{val}</td>"
                html += "</tr>"

            html += "</tbody></table>"
            return f'<div class="element" style="{css}">{html}</div>'

        # TABLE raw HTML
        try:
            table_html = Template(html_raw).render(**context)
        except:
            table_html = html_raw
        return f'<div class="element" style="{css}">{table_html}</div>'

    # SIMPLE BLOCKS
    if etype in ("line", "shape"):
        return f'<div class="element" style="{css}"></div>'

    # fallback
    return f'<div class="element" style="{css}">[unknown element]</div>'


def render_template_html(template_json: dict, context: dict) -> str:
    pages_html = []

    pages = template_json.get("pages", [])
    if not isinstance(pages, list) or len(pages) == 0:
        return "<h3>No pages in template</h3>"

    for page in pages:
        pw = page.get("w", 794)
        ph = page.get("h", 1123)
        bg = page.get("background", "")
        elements = page.get("elements", [])

        style = (
            f"width:{pw}px;"
            f"height:{ph}px;"
            "background:white;"
            "position:relative;"
            "margin:20px auto;"
            "page-break-after:always;"
            "box-sizing:border-box;"
        )

        if bg:
            style += f"background-image:url('{bg}');background-size:cover;background-position:center;"

        html = [f'<div class="paper" style="{style}">']
        for el in elements:
            html.append(render_element(el, context))
        html.append("</div>")

        pages_html.append("\n".join(html))

    return f"""
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            body {{
                margin:0;
                padding:0;
                font-family:Kanit, sans-serif;
                background:#f5f5f5;
            }}
            .paper {{
                box-shadow: 0 4px 20px rgba(0,0,0,0.1);
                border: 1px solid #ddd;
            }}
            .element {{
                box-sizing: border-box;
            }}
            table {{
                width: 100%;
                border-collapse: collapse;
            }}
            table td, table th {{
                border: 1px solid #ddd;
                padding: 8px;
            }}
        </style>
    </head>
    <body>
        {''.join(pages_html)}
    </body>
    </html>
    """
