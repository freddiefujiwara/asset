from playwright.sync_api import sync_playwright, expect
import json

def verify_fire_simulation(page):
    # Mock API
    page.route("https://script.google.com/**", lambda route: route.fulfill(
        status=200,
        content_type="application/json",
        body=json.dumps({
            "totals": {"assetsYen": 63715211},
            "summary": {
                "assetsByClass": [
                    {"name": "預金・現金", "amountYen": 6869123},
                    {"name": "株式（現物）", "amountYen": 56846088}
                ]
            },
            "holdings": {
                "cashLike": [
                    {"category": "預金・現金", "名称・説明": "銀行", "残高": "6869123"}
                ],
                "stocks": [
                    {"category": "株式（現物）", "銘柄名": "株", "評価額": "56846088"}
                ]
            },
            "cashFlow": []
        })
    ))

    page.goto("http://localhost:5174/asset/")
    page.evaluate("window.localStorage.setItem('asset-google-id-token', 'mock-token')")
    page.goto("http://localhost:5174/asset/fire")
    page.reload()
    page.wait_for_timeout(5000)

    page.screenshot(path="debug_fire_3.png")

    # Check if table exists
    if page.locator(".simulation-table").count() > 0:
        page.locator(".simulation-table-card").screenshot(path="fire_simulation_table.png")
    else:
        print("Table not found")

    # Algorithm details
    details = page.locator("details").filter(has_text="FIREアルゴリズムの詳細")
    if details.count() > 0:
        details.click()
        page.wait_for_timeout(500)
        details.screenshot(path="fire_algorithm_details.png")
    else:
        print("Details not found")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            verify_fire_simulation(page)
            print("Verification finished.")
        except Exception as e:
            print(f"Error: {e}")
        finally:
            browser.close()
