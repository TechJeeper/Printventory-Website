
from playwright.sync_api import sync_playwright, expect
import time

def verify_supporters():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Navigate to the page
        page.goto('http://localhost:8000/index.html')

        # Wait for the supporter bar to appear
        banner = page.locator('.supporters-bar')
        expect(banner).to_be_visible()

        # Check static text
        expect(banner).to_contain_text("Thank you to our Supporters:")

        # Check for the name span
        name_span = page.locator('#supporter-name')
        expect(name_span).to_be_visible()

        # Take a screenshot of the initial state
        page.screenshot(path='/home/jules/verification/supporters_initial.png')
        print("Initial screenshot taken.")

        # Wait for potential update (supporters.js has 500ms fade out + text update + fade in)
        # We want to catch the name visible.
        # Initial state is "Loading..."

        # Let's wait for the "Loading..." text to change to something else
        # Assuming supporters.list has content.

        # Read supporters.list to know what to expect
        with open('supporters.list', 'r') as f:
            first_supporter = f.readline().strip()

        if first_supporter:
            print(f"Expecting first supporter: {first_supporter}")
            # Wait for text to appear
            expect(name_span).to_contain_text(first_supporter, timeout=10000)

            # Take a screenshot with the name
            page.screenshot(path='/home/jules/verification/supporters_loaded.png')
            print("Loaded screenshot taken.")

        browser.close()

if __name__ == "__main__":
    verify_supporters()
