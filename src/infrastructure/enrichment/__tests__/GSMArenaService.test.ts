import { describe, it, expect, vi, beforeEach } from "vitest";
import axios from "axios";

vi.mock("axios");
const mockedAxios = vi.mocked(axios, true);

// Import after mocking
import { searchGSMArena, fetchGSMArenaDevice } from "../GSMArenaService";

// ── Fake GSMArena HTML ─────────────────────────────────────────────────────────

function makeSearchHtml(results: { href: string; span1: string; span2: string }[]) {
  const items = results
    .map(
      ({ href, span1, span2 }) => `
      <li>
        <a href="${href}">
          <img src="thumb.jpg" />
          <strong>
            <span>${span1}</span>
            <span>${span2}</span>
          </strong>
        </a>
      </li>`
    )
    .join("");
  return `<div class="makers"><ul>${items}</ul></div>`;
}

function makeDeviceHtml(name: string, imageUrl: string) {
  return `
    <html><body>
      <h1 class="specs-phone-name-title">${name}</h1>
      <div class="specs-photo-main">
        <a><img src="${imageUrl}" /></a>
      </div>
      <div class="specs-photo">
        <img src="${imageUrl}" />
      </div>
      <div class="pictures-list">
        <ul>
          <li><a><img src="${imageUrl}" /></a></li>
        </ul>
      </div>
      <table id="specs-list"></table>
    </body></html>
  `;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("searchGSMArena", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns device URL when brand appears only in first span", async () => {
    // GSMArena puts brand+family in span1 and model/variant in span2.
    // The old bug: only span2 was read, so brand check always failed.
    mockedAxios.get = vi.fn().mockResolvedValueOnce({
      data: makeSearchHtml([
        {
          href: "samsung_galaxy_s25-12345.php",
          span1: "Samsung Galaxy ",
          span2: "S25",
        },
      ]),
    });

    const url = await searchGSMArena("Samsung Galaxy S25", "Samsung");
    expect(url).toBe("https://www.gsmarena.com/samsung_galaxy_s25-12345.php");
  });

  it("returns device URL for Apple when brand is in first span", async () => {
    mockedAxios.get = vi.fn().mockResolvedValueOnce({
      data: makeSearchHtml([
        {
          href: "apple_iphone_17-12346.php",
          span1: "Apple iPhone ",
          span2: "17",
        },
      ]),
    });

    const url = await searchGSMArena("Apple iPhone 17", "Apple");
    expect(url).toBe("https://www.gsmarena.com/apple_iphone_17-12346.php");
  });

  it("rejects result from wrong brand", async () => {
    mockedAxios.get = vi.fn().mockResolvedValueOnce({
      data: makeSearchHtml([
        {
          href: "samsung_galaxy_s25-12345.php",
          span1: "Samsung Galaxy ",
          span2: "S25",
        },
      ]),
    });

    // Searching for Apple but only Samsung result returned
    const url = await searchGSMArena("Apple iPhone 17", "Apple");
    expect(url).toBeNull();
  });

  it("rejects variant suffix mismatches (strict model match)", async () => {
    // Searching for base "iPhone 17" should not match "iPhone 17 Pro Max"
    mockedAxios.get = vi.fn().mockResolvedValueOnce({
      data: makeSearchHtml([
        {
          href: "apple_iphone_17_pro_max-12347.php",
          span1: "Apple iPhone ",
          span2: "17 Pro Max",
        },
      ]),
    });

    const url = await searchGSMArena("Apple iPhone 17", "Apple");
    expect(url).toBeNull();
  });

  it("returns null when axios throws", async () => {
    mockedAxios.get = vi.fn().mockRejectedValueOnce(new Error("Network error"));
    const url = await searchGSMArena("Samsung Galaxy S25", "Samsung");
    expect(url).toBeNull();
  });
});

describe("fetchGSMArenaDevice", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("extracts name and image from device page", async () => {
    const imageUrl = "https://fdn2.gsmarena.com/vv/bigpic/samsung-galaxy-s25.jpg";
    mockedAxios.get = vi.fn().mockResolvedValueOnce({
      data: makeDeviceHtml("Samsung Galaxy S25", imageUrl),
    });

    const result = await fetchGSMArenaDevice(
      "https://www.gsmarena.com/samsung_galaxy_s25-12345.php",
      "Samsung"
    );

    expect(result).not.toBeNull();
    expect(result!.name).toBe("Samsung Galaxy S25");
    expect(result!.officialImages.length).toBeGreaterThan(0);
    expect(result!.officialImages[0]).toBe(imageUrl);
  });

  it("returns null when device name does not match brand", async () => {
    const imageUrl = "https://fdn2.gsmarena.com/vv/bigpic/samsung-galaxy-s25.jpg";
    mockedAxios.get = vi.fn().mockResolvedValueOnce({
      data: makeDeviceHtml("Samsung Galaxy S25", imageUrl),
    });

    // brand=Apple but page is Samsung
    const result = await fetchGSMArenaDevice(
      "https://www.gsmarena.com/samsung_galaxy_s25-12345.php",
      "Apple"
    );
    expect(result).toBeNull();
  });
});
