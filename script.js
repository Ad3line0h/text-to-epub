const editor = document.getElementById('editor');
const codeView = document.getElementById('code-view');
const cssEditor = document.getElementById('css-editor');

// 단축키
editor.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
            case '1': e.preventDefault(); exec('formatBlock', 'h1'); break;
            case '2': e.preventDefault(); exec('formatBlock', 'h2'); break;
            case 'p': e.preventDefault(); exec('formatBlock', 'p'); break;
        }
    }
});

function exec(command, value = null) {
    editor.focus();
    document.execCommand(command, false, value);
    updateCode();
}

// XHTML
function updateCode() {
    const temp = document.createElement('div');
    temp.innerHTML = editor.innerHTML;

    temp.querySelectorAll('div').forEach(div => {
        const p = document.createElement('p');
        p.innerHTML = div.innerHTML;
        div.parentNode.replaceChild(p, div);
    });

    let formatted = "";
    const tab = "  ";

    temp.childNodes.forEach(node => {
        if (node.nodeType === Node.ELEMENT_NODE) {
            const tag = node.tagName.toLowerCase();
            const content = node.innerHTML.replace(/<br>/gi, "<br />").replace(/<img ([^>]+)>/gi, "<img $1 />").trim();
            formatted += `${tab}<${tag}>${content || '<br />'}</${tag}>\n`;
        } else if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
            formatted += `${tab}<p>${node.textContent.trim()}</p>\n`;
        }
    });
    codeView.innerText = formatted.trim();
}

// EPUB 변환 스크립트
// 아직도 원리 이해 못함
// 근데 작동하니까 안건드릴거임
document.getElementById('download-epub').onclick = async () => {
    try {
        const zip = new JSZip();
        const title = document.getElementById('book-title').value || "무제";
        const author = document.getElementById('book-author').value || "";
        const uuid = `urn:uuid:${crypto.randomUUID()}`;
        const coverFile = document.getElementById('cover-upload').files[0];

        zip.file("mimetype", "application/epub+zip", { compression: "STORE" });
        zip.folder("META-INF").file("container.xml", `<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`);

        const oebps = zip.folder("OEBPS");
        const textF = oebps.folder("Text");
        const imgF = oebps.folder("Images");

        let manifest = "", spine = "", nav = "", playOrder = 1;

        // 표지
        if (coverFile) {
            const ext = coverFile.name.split('.').pop();
            imgF.file(`cover.${ext}`, await coverFile.arrayBuffer());
            textF.file("cover.xhtml", wrapX("Cover", `<div style="text-align:center;"><img src="../Images/cover.${ext}" alt="c" /></div>`));
            manifest += `<item id="ci" href="Images/cover.${ext}" media-type="image/${ext==='png'?'png':'jpeg'}"/><item id="cx" href="Text/cover.xhtml" media-type="application/xhtml+xml"/>`;
            spine += `<itemref idref="cx"/>`;
            nav += `<navPoint id="n0" playOrder="${playOrder++}"><navLabel><text>표지</text></navLabel><content src="Text/cover.xhtml"/></navPoint>`;
        }

        // section 분할
        // 목차 연동
        const chapters = getChapters(title);
        chapters.forEach((ch, i) => {
            const id = `s${i+1}`;
            textF.file(`${id}.xhtml`, wrapX(ch.title, ch.data));
            manifest += `<item id="${id}" href="Text/${id}.xhtml" media-type="application/xhtml+xml"/>`;
            spine += `<itemref idref="${id}"/>`;
            nav += `<navPoint id="np${i+1}" playOrder="${playOrder++}"><navLabel><text>${ch.title}</text></navLabel><content src="Text/${id}.xhtml"/></navPoint>`;
        });

        // 필수 파일
        oebps.folder("Styles").file("Style0001.css", cssEditor.value);
        oebps.file("toc.ncx", `<?xml version="1.0" encoding="UTF-8"?><ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1"><head><meta name="dtb:uid" content="${uuid}"/></head><docTitle><text>${title}</text></docTitle><navMap>${nav}</navMap></ncx>`);
        oebps.file("content.opf", `<?xml version="1.0" encoding="utf-8"?><package xmlns="http://www.idpf.org/2007/opf" unique-identifier="id" version="2.0"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:opf="http://www.idpf.org/2007/opf"><dc:identifier id="id">${uuid}</dc:identifier><dc:title>${title}</dc:title><dc:creator opf:role="aut">${author}</dc:creator><dc:language>ko</dc:language>${coverFile?'<meta name="cover" content="ci"/>':''}</metadata><manifest><item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/><item id="css" href="Styles/Style0001.css" media-type="text/css"/>${manifest}</manifest><spine toc="ncx">${spine}</spine></package>`);

        const blob = await zip.generateAsync({ type: "blob" });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${title}.epub`;
        a.click();
    } catch (e) { alert("에러: " + e.message); }
};

function getChapters(bookTitle) {
    const html = editor.innerHTML.trim();
    const tag = document.getElementById('split-h1').checked ? "h1" : (document.getElementById('split-h2').checked ? "h2" : null);
    if (!tag) return [{ title: bookTitle, data: `<h1>${bookTitle}</h1>${html}` }];
    const segs = html.split(new RegExp(`(?=<${tag}[^>]*>)`, 'i')).filter(s => s.trim());
    return segs.map((c, i) => {
        const m = c.match(new RegExp(`<${tag}[^>]*>(.*?)<\/${tag}>`, 'i'));
        return { title: m ? m[1].replace(/<[^>]*>/g, "") : `Chapter ${i+1}`, data: c };
    });
}

function wrapX(t, b) {
    return `<?xml version="1.0" encoding="UTF-8" standalone="no" ?><!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd"><html xmlns="http://www.w3.org/1999/xhtml"><head><title>${t}</title><link href="../Styles/Style0001.css" type="text/css" rel="stylesheet"/></head><body>${b}</body></html>`;
}

editor.addEventListener('input', updateCode);
if (!editor.innerHTML.trim()) editor.innerHTML = '<p><br></p>';
updateCode();