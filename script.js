const editor = document.getElementById("editor");
const codeView = document.getElementById("code-view");
const cssEditor = document.getElementById("css-editor");
const placeholder = document.getElementById("editor-placeholder");

// 파일 불러오기
function handleFile(input) {
  console.log("--- handleFile 함수 호출 ---");
  const file = input.files[0];
  if (!file) return;

  const fileName = file.name.toLowerCase();
  const editor = document.getElementById("editor");

  // TXT
  if (fileName.endsWith(".txt")) {
    const reader = new FileReader();
    reader.onload = function (e) {
      const text = e.target.result;
      editor.innerHTML = text
        .split("\n")
        .map((line) => (line.trim() ? `<p>${line.trim()}</p>` : "<p><br></p>"))
        .join("");

      finishImport();
    };
    reader.readAsText(file, "utf-8");
  }
  // DOCX
  else if (fileName.endsWith(".docx")) {
    const reader = new FileReader();
    reader.onload = function (e) {
      const arrayBuffer = e.target.result;
      mammoth
        .convertToHtml({ arrayBuffer: arrayBuffer })
        .then(function (result) {
          editor.innerHTML = result.value;
          finishImport();
        })
        .catch(function (err) {
          console.error("docx 변환 실패:", err);
          alert("docx 파일을 읽는 중 오류가 발생했습니다.");
        });
    };
    reader.readAsArrayBuffer(file);
  } else {
    alert("지원하지 않는 파일 형식입니다. (.txt, .docx)");
  }

  function finishImport() {
    if (typeof updateCode === "function") updateCode();
    if (typeof checkContent === "function") checkContent();
    input.value = "";
  }
}

// 플레이스홀더
function checkContent() {
  if (editor.innerText.trim().length > 0) {
    editor.classList.add("has-content");
    placeholder.style.display = "none";
  } else {
    editor.classList.remove("has-content");
    placeholder.style.display = "block";
  }
}

document
  .getElementById("cover-upload")
  .addEventListener("change", function (e) {
    const file = e.target.files[0];
    const nameDisplay = document.getElementById("file-name-display");
    const tooltip = document.getElementById("thumbnail-tooltip");

    if (file && file.type.startsWith("image/")) {
      nameDisplay.textContent = file.name;

      const reader = new FileReader();
      reader.onload = function (event) {
        tooltip.style.backgroundImage = `url(${event.target.result})`;
      };
      reader.readAsDataURL(file);
    } else {
      nameDisplay.textContent = "선택된 파일 없음";
      tooltip.style.backgroundImage = "none";
    }
  });

// 단축키
editor.addEventListener("keydown", (e) => {
  if (e.ctrlKey || e.metaKey) {
    switch (e.key.toLowerCase()) {
      case "1":
        e.preventDefault();
        format("formatBlock", "h1");
        break;
      case "2":
        e.preventDefault();
        format("formatBlock", "h2");
        break;
      case "p":
        e.preventDefault();
        format("formatBlock", "p");
        break;
    }
  }
});

// XHTML
function updateCode() {
  const temp = document.createElement("div");
  temp.innerHTML = editor.innerHTML;

  temp.querySelectorAll("div").forEach((div) => {
    const p = document.createElement("p");
    p.innerHTML = div.innerHTML;
    div.parentNode.replaceChild(p, div);
  });

  let formatted = "";
  const tab = "  ";

  temp.childNodes.forEach((node) => {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const tag = node.tagName.toLowerCase();
      const content = node.innerHTML
        .replace(/<br>/gi, "<br />")
        .replace(/<img ([^>]+)>/gi, "<img $1 />")
        .trim();
      formatted += `${tab}<${tag}>${content || "<br />"}</${tag}>\n`;
    } else if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
      formatted += `${tab}<p>${node.textContent.trim()}</p>\n`;
    }
  });
  codeView.innerText = formatted.trim();
  
  // EPUB 미리보기 업데이트
  updatePreview();
}

// 서식 없이 붙여넣기
editor.addEventListener("paste", function (e) {
  e.preventDefault();
  const text = (e.originalEvent || e).clipboardData.getData("text/plain");
  document.execCommand("insertText", false, text);
  updateCode();
  checkContent();
});

// 텍스트 툴바
function format(command, value = null) {
  if (command === "formatBlock") {
    const currentBlock = document.queryCommandValue("formatBlock");
    if (currentBlock.toLowerCase() === value.toLowerCase()) {
      document.execCommand("formatBlock", false, "p");
    } else {
      document.execCommand("formatBlock", false, value);
    }
  } else {
    document.execCommand(command, false, value);
  }

  editor.focus();
  updateCode();
  updateToolbar();
  checkContent();
}

function updateToolbar() {
  const buttons = document.querySelectorAll(".editor-toolbar button");
  buttons.forEach((btn) => {
    const onClickAttr = btn.getAttribute("onclick");
    if (!onClickAttr) return;

    const parts = onClickAttr.split("'");
    if (parts.length < 2) return;

    const command = parts[1];
    const value = parts[3];

    if (command === "formatBlock" && value) {
      const currentBlock = document.queryCommandValue("formatBlock");
      if (currentBlock.toLowerCase() === value.toLowerCase()) {
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
      }
    } else {
      if (document.queryCommandState(command)) {
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
      }
    }
  });
}

document.addEventListener("selectionchange", () => {
  if (document.activeElement === editor) updateToolbar();
});

editor.addEventListener("click", updateToolbar);
editor.addEventListener("keyup", () => {
  updateToolbar();
  updateCode();
  checkContent();
});
editor.addEventListener("input", () => {
  updateCode();
  checkContent();
});

// EPUB 다운로드
document.getElementById("download-epub").onclick = async () => {
  try {
    const zip = new JSZip();
    const title = document.getElementById("book-title").value || "무제";
    const author = document.getElementById("book-author").value || "";
    const uuid = `urn:uuid:${crypto.randomUUID()}`;
    const coverFile = document.getElementById("cover-upload").files[0];

    zip.file("mimetype", "application/epub+zip", { compression: "STORE" });
    zip
      .folder("META-INF")
      .file(
        "container.xml",
        `<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`,
      );

    const oebps = zip.folder("OEBPS");
    const textF = oebps.folder("Text");
    const imgF = oebps.folder("Images");

    let manifest = "",
      spine = "",
      nav = "",
      playOrder = 1;

    if (coverFile) {
      const ext = coverFile.name.split(".").pop();
      imgF.file(`cover.${ext}`, await coverFile.arrayBuffer());
      textF.file(
        "cover.xhtml",
        wrapX(
          "Cover",
          `<div style="text-align:center;"><img src="../Images/cover.${ext}" alt="c" /></div>`,
        ),
      );
      manifest += `<item id="ci" href="Images/cover.${ext}" media-type="image/${ext === "png" ? "png" : "jpeg"}"/><item id="cx" href="Text/cover.xhtml" media-type="application/xhtml+xml"/>`;
      spine += `<itemref idref="cx"/>`;
      nav += `<navPoint id="n0" playOrder="${playOrder++}"><navLabel><text>표지</text></navLabel><content src="Text/cover.xhtml"/></navPoint>`;
    }

    const chapters = getChapters(title);
    chapters.forEach((ch, i) => {
      const id = `s${i + 1}`;
      textF.file(`${id}.xhtml`, wrapX(ch.title, ch.data));
      manifest += `<item id="${id}" href="Text/${id}.xhtml" media-type="application/xhtml+xml"/>`;
      spine += `<itemref idref="${id}"/>`;
      nav += `<navPoint id="np${i + 1}" playOrder="${playOrder++}"><navLabel><text>${ch.title}</text></navLabel><content src="Text/${id}.xhtml"/></navPoint>`;
    });

    oebps.folder("Styles").file("Style0001.css", cssEditor.value);
    oebps.file(
      "toc.ncx",
      `<?xml version="1.0" encoding="UTF-8"?><ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1"><head><meta name="dtb:uid" content="${uuid}"/></head><docTitle><text>${title}</text></docTitle><navMap>${nav}</navMap></ncx>`,
    );
    oebps.file(
      "content.opf",
      `<?xml version="1.0" encoding="utf-8"?><package xmlns="http://www.idpf.org/2007/opf" unique-identifier="id" version="2.0"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:opf="http://www.idpf.org/2007/opf"><dc:identifier id="id">${uuid}</dc:identifier><dc:title>${title}</dc:title><dc:creator opf:role="aut">${author}</dc:creator><dc:language>ko</dc:language>${coverFile ? '<meta name="cover" content="ci"/>' : ""}</metadata><manifest><item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/><item id="css" href="Styles/Style0001.css" media-type="text/css"/>${manifest}</manifest><spine toc="ncx">${spine}</spine></package>`,
    );

    const blob = await zip.generateAsync({
      type: "blob",
      mimeType: "application/epub+zip",
    });

    const a = document.createElement("a");
    const url = URL.createObjectURL(blob);
    a.href = url;
    a.download = `${title}.epub`;
    a.click();

    setTimeout(() => {
      URL.revokeObjectURL(url);
      a.remove();
    }, 100);
  } catch (e) {
    alert("error: " + e.message);
  }
};

function getChapters(bookTitle) {
  const html = editor.innerHTML.trim();
  const tag = document.getElementById("split-h1").checked
    ? "h1"
    : document.getElementById("split-h2").checked
      ? "h2"
      : null;
  if (!tag) return [{ title: bookTitle, data: `<h1>${bookTitle}</h1>${html}` }];
  const segs = html
    .split(new RegExp(`(?=<${tag}[^>]*>)`, "i"))
    .filter((s) => s.trim());
  return segs.map((c, i) => {
    const m = c.match(new RegExp(`<${tag}[^>]*>(.*?)<\/${tag}>`, "i"));
    return {
      title: m ? m[1].replace(/<[^>]*>/g, "") : `Chapter ${i + 1}`,
      data: c,
    };
  });
}

function wrapX(t, b) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="no" ?><!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd"><html xmlns="http://www.w3.org/1999/xhtml"><head><title>${t}</title><link href="../Styles/Style0001.css" type="text/css" rel="stylesheet"/></head><body>${b}</body></html>`;
}

// 파일 불러오기
function handleFile(input) {
  const file = input.files[0];
  if (!file) return;

  const reader = new FileReader();

  // txt
  if (file.name.toLowerCase().endsWith(".txt")) {
    reader.onload = function (e) {
      const text = e.target.result;
      editor.innerHTML = text
        .split("\n")
        .map((line) => (line.trim() ? `<p>${line.trim()}</p>` : "<p><br></p>"))
        .join("");

      updateCode();
      checkContent();
    };
    reader.readAsText(file, "utf-8");
  }
  // docx
  else if (file.name.toLowerCase().endsWith(".docx")) {
    reader.onload = function (e) {
      const arrayBuffer = e.target.result;
      if (typeof mammoth === "undefined") {
        alert("라이브러리 로딩 중입니다. 잠시만 기다려주세요.");
        return;
      }
      mammoth
        .convertToHtml({ arrayBuffer: arrayBuffer })
        .then(function (result) {
          editor.innerHTML = result.value;
          updateCode();
          checkContent();
        });
    };
    reader.readAsArrayBuffer(file);
  }

  input.value = "";
}

// 초기화 실행
// 메모리 절약 때문이라는데 걍 시켜서 하는거임
window.addEventListener("load", () => {
  if (!editor.innerHTML.trim()) editor.innerHTML = "<p><br></p>";
  updateCode();
  checkContent();
});

// 새로고침 방지
window.addEventListener("beforeunload", (event) => {
  if (editor.innerText.trim().length > 0) {
    event.preventDefault();
    event.returnValue = "";
  }
});

// 모바일 헤더 숨기기
let lastScrollY = window.scrollY;
const header = document.querySelector("header");

window.addEventListener("scroll", () => {
  const currentScrollY = window.scrollY;

  if (currentScrollY > lastScrollY && currentScrollY > 50) {
    header.classList.add("hide");
  } else {
    header.classList.remove("hide");
  }

  lastScrollY = currentScrollY;
});

// EPUB 미리보기 업데이트
function updatePreview() {
  const epubPreview = document.getElementById("epub-preview");
  const temp = document.createElement("div");
  temp.innerHTML = editor.innerHTML;

  temp.querySelectorAll("div").forEach((div) => {
    const p = document.createElement("p");
    p.innerHTML = div.innerHTML;
    div.parentNode.replaceChild(p, div);
  });

  epubPreview.innerHTML = temp.innerHTML;
  
  // CSS 적용
  applyCustomCSS();
}

// CSS 스타일을 미리보기에도 적용
function applyCustomCSS() {
  const epubPreview = document.getElementById("epub-preview");
  let styleEl = epubPreview.querySelector("style");
  
  if (!styleEl) {
    styleEl = document.createElement("style");
    epubPreview.insertBefore(styleEl, epubPreview.firstChild);
  }
  
  styleEl.textContent = cssEditor.value;
}

// CSS 에디터 변경 시 미리보기 업데이트
cssEditor.addEventListener("input", () => {
  applyCustomCSS();
});

// 탭 전환 기능
document.addEventListener("DOMContentLoaded", () => {
  const tabButtons = document.querySelectorAll(".tab-btn");
  
  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetTab = btn.getAttribute("data-tab");
      const parentPane = btn.closest(".pane");
      
      // 같은 패널 내의 탭 버튼들만 비활성화
      parentPane.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
      // 클릭한 탭 버튼 활성화
      btn.classList.add("active");
      
      // 같은 패널 내의 탭 컨텐츠만 숨기기
      parentPane.querySelectorAll(".tab-content").forEach((content) => {
        content.classList.remove("active");
      });
      
      // 선택한 탭 컨텐츠 표시
      if (targetTab === "editor") {
        document.getElementById("editor-tab").classList.add("active");
      } else if (targetTab === "css") {
        document.getElementById("css-tab").classList.add("active");
      } else if (targetTab === "xhtml") {
        document.getElementById("code-view").classList.add("active");
      } else if (targetTab === "preview") {
        document.getElementById("epub-preview").classList.add("active");
      }
    });
  });
});