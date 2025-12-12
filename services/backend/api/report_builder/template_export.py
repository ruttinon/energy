# /mnt/data/template_export.py
import os
import asyncio
from playwright.async_api import async_playwright

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))

async def html_to_pdf(html: str, output_path: str):
    """Render HTML → PDF using Playwright Chromium (เสถียรสุด)."""
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)

        page = await browser.new_page()

        await page.set_content(html, wait_until="networkidle")

        await page.pdf(
            path=output_path,
            format="A4",
            print_background=True,
            margin={"top": "0px", "bottom": "0px", "left": "0px", "right": "0px"},
        )

        await browser.close()

    return output_path


def export_pdf(html: str, out_path: str):
    """Sync wrapper for async html_to_pdf."""
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

    return loop.run_until_complete(html_to_pdf(html, out_path))
