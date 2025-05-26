import time
import json
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from bs4 import BeautifulSoup

def search_and_scrape_classes(search_text):
    print(f"\nSearching for: {search_text}")

    options = Options()
    options.add_argument('--headless')
    options.add_argument('--disable-gpu')
    options.add_argument('--no-sandbox')
    options.add_argument('--disable-dev-shm-usage')
    options.add_argument('--window-size=1920x1080')

    driver = webdriver.Chrome(options=options)
    driver.get("https://classes.ku.edu/")

    try:
        # Type into the search field
        search_input = WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.ID, "classesSearchText"))
        )
        search_input.clear()
        search_input.send_keys(search_text)
        time.sleep(2)  # wait for autocomplete
        search_input.send_keys(Keys.ARROW_DOWN)
        search_input.send_keys(Keys.ENTER)
        print("Autocomplete selected.")

        # Click the search button
        search_button = WebDriverWait(driver, 10).until(
            EC.element_to_be_clickable((By.CSS_SELECTOR, ".classSearchButton"))
        )
        search_button.click()
        print("Search submitted.")

        # Wait for the actual data inside AJAX div
        WebDriverWait(driver, 60).until(
            EC.text_to_be_present_in_element((By.ID, "classes_ajaxDiv"), "Seats Available")
        )
        results_div = driver.find_element(By.ID, "classes_ajaxDiv")
        html = results_div.get_attribute("innerHTML")

        # Optional screenshot
        with open("debug_screenshot.png", "wb") as f:
            f.write(driver.get_screenshot_as_png())
            print("📸 Screenshot saved as debug_screenshot.png")

        # Parse with BeautifulSoup
        soup = BeautifulSoup(html, "html.parser")
        all_courses = []

        for h3 in soup.find_all("h3"):
            course_title = h3.get_text(strip=True)
            table = h3.find_next("table", class_="class_list")
            if not table:
                continue

            rows = table.find_all("tr")[1:]  # skip header
            sections = []
            i = 0
            while i < len(rows):
                cols = rows[i].find_all("td")
                if len(cols) == 5:
                    save_link = cols[3].find("a", class_="saveSectionLink")
                    class_number_tag = cols[3].find("strong")

                    section = {
                        "type": cols[0].get_text(strip=True),
                        "instructor": cols[1].get_text(strip=True),
                        "credit_hours": cols[2].get_text(strip=True),
                        "class_number": class_number_tag.get_text(strip=True) if class_number_tag else cols[3].get_text(strip=True),
                        "seats_available": cols[4].get_text(strip=True),
                        "meeting_time": "",
                        "location": "",
                        "section_number": save_link.get("data-section-number", "") if save_link else "",
                        "subject": save_link.get("data-search-subject", "") if save_link else "",
                        "course_id": save_link.get("data-search-course-id", "") if save_link else "",
                        "term": save_link.get("data-search-term", "") if save_link else ""
                    }

                    # Search for meeting info in next 3 rows
                    for offset in range(1, 4):
                        if i + offset >= len(rows):
                            break
                        potential_row = rows[i + offset]
                        potential_cols = potential_row.find_all("td")
                        if len(potential_cols) == 3:
                            meeting_raw = potential_cols[1]
                            section["meeting_time"] = meeting_raw.get_text(strip=True)

                            location = ""
                            span = meeting_raw.find("span")
                            link = meeting_raw.find("a")
                            if span and span.get_text(strip=True):
                                location = span.get_text(strip=True)
                            elif link and link.get_text(strip=True):
                                location = link.get_text(strip=True)
                            elif meeting_raw.get_text(strip=True):
                                location = meeting_raw.get_text(strip=True)

                            section["location"] = location
                            break

                    sections.append(section)
                    i += 2
                else:
                    i += 1

            all_courses.append({
                "course": course_title,
                "sections": sections
            })

        print(json.dumps(all_courses, indent=2))

    except Exception as e:
        print("❌ Error:", str(e))
    finally:
        driver.quit()

if __name__ == "__main__":
    search_and_scrape_classes("EECS 690 MATH 104 EECS 202")