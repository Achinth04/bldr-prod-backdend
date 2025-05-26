import json
import time
import re
import sys

from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait, Select
from selenium.webdriver.support import expected_conditions as EC

from bs4 import BeautifulSoup


def parse_schedule(raw: str):
    txt = " ".join(raw.split())
    parts = txt.split(" ", 1)
    if len(parts) < 2:
        return "", "", ""
    
    days = parts[0]
    time_part = parts[1]
    time_parts = time_part.split("-")

    if len(time_parts) == 2:
        start_raw = time_parts[0].strip()
        end_time = time_parts[1].strip()

        # Determine AM/PM for start time using heuristic
        hour_part = start_raw.split(":")[0]
        try:
            hour = int(hour_part)
            if 8 <= hour <= 11:
                start_time = f"{start_raw} AM"
            else:
                start_time = f"{start_raw} PM"
        except ValueError:
            start_time = start_raw  # fallback

    else:
        start_time = end_time = ""

    return days, start_time, end_time



def scrape_ku_classes(subject: str, term_value: str = "4259"):
    chrome_opts = Options()
    chrome_opts.add_argument("--headless")
    chrome_opts.add_argument('--disable-gpu')
    chrome_opts.add_argument('--no-sandbox')
    chrome_opts.add_argument('--disable-dev-shm-usage')
    chrome_opts.add_argument('--window-size=1920x1080')

    driver = webdriver.Chrome(options=chrome_opts)

    try:
        driver.get("https://classes.ku.edu/")
        Select(WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.ID, "classesSearchCareer"))
        )).select_by_value("UndergraduateGraduate")

        Select(driver.find_element(By.ID, "classesSearchTerm")).select_by_value(term_value)

        search = driver.find_element(By.ID, "classesSearchText")
        search.clear()
        search.send_keys(subject, Keys.RETURN)
        time.sleep(2)
        search.send_keys(Keys.ARROW_DOWN)
        search.send_keys(Keys.ENTER)

        WebDriverWait(driver, 10).until(
            EC.element_to_be_clickable((By.CSS_SELECTOR, ".btn.btn-primary.classSearchButton"))
        ).click()

        WebDriverWait(driver, 15).until(
            EC.text_to_be_present_in_element((By.ID, "classes_ajaxDiv"), "Seats Available")
        )

        ajax = driver.find_element(By.ID, "classes_ajaxDiv")
        html = ajax.get_attribute("innerHTML")

    except Exception as e:
        print(json.dumps({"error": str(e)}))
        driver.quit()
        sys.exit(1)
    finally:
        driver.quit()

    soup = BeautifulSoup(html, "html.parser")
    courses = []

    for h3 in soup.find_all("h3"):
        header_tr = h3.find_parent("tr")
        if not header_tr:
            continue
        desc_tr = header_tr.find_next_sibling(lambda t: t.name == "tr")
        if not desc_tr:
            continue
        desc_td = desc_tr.find("td")
        course_title = h3.get_text(strip=True)
        course_code = course_title.split()[1] if course_title else ""
        desc_text = re.sub(r"\s+", " ", desc_td.get_text(" ", strip=True)).strip()

        sec_tr = desc_tr.find_next_sibling(lambda t: t.name == "tr")
        if not sec_tr:
            continue
        table = sec_tr.find("table", class_="class_list")
        if not table:
            continue

        sections = []
        rows = table.find_all("tr")[1:]
        i = 0
        while i < len(rows):
            cols = rows[i].find_all("td")
            if len(cols) == 5:
                save_link = cols[3].find("a", class_="saveSectionLink")
                class_number_tag = cols[3].find("strong")
                class_number = class_number_tag.get_text(strip=True) if class_number_tag else cols[3].get_text(strip=True)

                section = {
                    "type": cols[0].get_text(strip=True),
                    "instructor": cols[1].find("a").get_text(strip=True) if cols[1].find("a") else "",
                    "credit_hours": cols[2].get_text(strip=True),
                    "class_number": class_number,
                    "seats_available": cols[4].get_text(strip=True),
                    "days": "",
                    "start_time": "",
                    "end_time": "",
                    "building": "",
                    "room": "",
                    "campus": "",
                    "section_number": save_link.get("data-section-number", "") if save_link else "",
                    "dept": save_link.get("data-search-subject", "") if save_link else "",
                    "code": course_code,
                    "course_id": save_link.get("data-search-course-id", "") if save_link else "",
                    "term": save_link.get("data-search-term", "") if save_link else ""
                }

                if i + 1 < len(rows):
                    next_row = rows[i + 1]
                    next_cols = next_row.find_all("td")
                    if len(next_cols) >= 2:
                        detail = next_cols[1].get_text("|", strip=True).split("|")
                        raw_days = detail[0] if detail else ""
                        section["days"], section["start_time"], section["end_time"] = parse_schedule(raw_days)
                        room_str = detail[1] if len(detail) > 1 else ""
                        campus_str = detail[-1] if len(detail) > 0 else ""

                        bld_room = room_str.split(" ", 1) + [""]
                        section["building"] = bld_room[0]
                        section["room"] = bld_room[1]
                        section["campus"] = campus_str.lstrip("- ").strip()

                sections.append(section)
                i += 2
            else:
                i += 1

        courses.append({
            "course": course_title,
            "description": desc_text,
            "sections": sections
        })

    print(json.dumps(courses, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    subject = sys.argv[1] if len(sys.argv) > 1 else "SOC 104"
    term = sys.argv[2] if len(sys.argv) > 2 else "4259"
    scrape_ku_classes(subject, term)
