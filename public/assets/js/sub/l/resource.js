require("../auth");

require("../../../css/sub/l/resource.css");

// scripts
const SET = require("../set");
const FORM = require("../form");
const { notifier, validateData, redirectFunc, formatDate } = require("../mods");

/**
 * add new resource
 */
const _form = new FORM();
const addResourceBtn = SET.$('#addResource');
const closeAddResource = SET.$('#closeAddResource');
const addResourceForm = SET.$('#addResourceForm');
const pdfFileInput = addResourceForm.getElem('input[name=pdf_file]');
const submitBtns = addResourceForm.getElem('button[type=submit]', true);
const handleFileSelect = (e) => {
    if (!e.target.files || !e.target.files[0]) {
        return;
    }
    // val pdf file 
    let pdfFile = e.target.files[0];
    if (!validateData(pdfFile.type, /^(application\/pdf)$/)) {
        pdfFileInput.value = null;
        return notifier('Only pdf file type is valid.','error');
    }
}
const handleAddResourcetDisplay = () => {
    const addResourceModal = SET.$('#addResourceModal');
    if (addResourceModal.style.display === 'none' || getComputedStyle(addResourceModal).display === 'none') {
        SET.fixClass(['body'],[['no-overflow']],[true]);
        addResourceModal.style.display = 'block';
        return;
    }
    SET.fixClass(['body'],[['no-overflow']],[false]);
    addResourceModal.style.display = 'none';
    _form.reset('#addResourceForm');
    handleSaveBtn(null);
}
const handleAddResourceForm = function(e) {
    e.preventDefault();
    addResourceForm.disableForm();
    notifier('Processing resource upload...','default',null,'add_resource_noti');
    let addResourceData = _form.assembleFormData('#addResourceForm','formData');
    SET.ajax({
        url: this.attr('action'),
        method: this.attr('method'),
        body: addResourceData,
        headers: {
            'Content-Type': false
        },
        handler: (res, err) => {
            notifier(null,null,null,'add_resource_noti');
            addResourceForm.disableForm(false);
            if (err)
                return notifier(`${err.code ? err.code+': ' : ''}${err.msg}`,'error');
            const { error, errorMsg, data, force } = res;
            if (force) 
                return redirectFunc(force);
            if (error)
                return notifier(`${errorMsg}`,'error');
            if (data) {
                handleSaveBtn(null);
                _form.reset('#addResourceForm');
                return notifier(data,'success');
            }
            notifier('An error occurred processing request.','error');
        },
    });
}
const handleSaveBtn = e => {
    if (!e) {
        return submitBtns.forEach(eachBtn => eachBtn.attr('disabled', true));
    }
    submitBtns.forEach(eachBtn => eachBtn.attr('disabled', false));
}
pdfFileInput.on('change', handleFileSelect);
addResourceBtn.on('click', handleAddResourcetDisplay);
closeAddResource.on('click', handleAddResourcetDisplay);
addResourceForm.on('change', handleSaveBtn);
addResourceForm.on("submit", handleAddResourceForm);

/**
 * fetch resources
 */
const resourceTable = SET.$('#resourceList');
const resourceTableBody = resourceTable.getElem('tbody');
const resourceLoader = (loadingInfo = 'Loading resources, please wait...') => {
    if (!loadingInfo) {
        return SET.removeElem(resourceTableBody.getElem('#loader'));
    }
    resourceTable.getElem('tbody').appendElem(`<tr id="loader"><td colspan="11" style="text-align: center;">${loadingInfo}</td></td>`);
}
const fetchResource = (start = null, limit = null, empty = true, cb = null, url = '/l/resource/fetch') => {
    empty && resourceTableBody.html();
    resourceLoader();
    let params = [];
    start && params.push(`s=${start}`);
    limit && params.push(`l=${limit}`);
    SET.ajax({
        method: 'GET',
        url: SET.formatUrlParam(`${url}`, params),
        headers: {
            'Content-Type': false
        },
        handler: (res, err) => {
            resourceLoader(null);
            if (err)
                return notifier(`${err.code ? err.code+': ' : ''}${err.msg}`,'error');
            const { error, errorMsg, data, force } = res;
            if (force) 
                return redirectFunc(force);
            if (error)
                return notifier(`${errorMsg}`,'error');
            if (data) {
                const {resource, more} = data;
                if (resource.length <= 0) {
                    if (!start) {
                        resourceTableBody.html('<tr><td colspan="11" style="text-align: center;">No resource was found in the repository</td></tr>');
                    }
                } else {
                    resource.forEach((eachData) => {
                        addToResourceList(eachData);
                    });
                    if (more) {
                        resourceTableBody.appendElem(`<tr class="r-item"><td colspan="11" style="text-align: center;"><a href="javascript:void(0);" id="more" style="text-decoration: underline; font-size: 14px;">More Resources</a></td></tr>`);
                        moreLoad(more);
                    }
                }
                cb && cb();
                return;
            }
            notifier('An error occurred processing request.','error');
        },
    });
}
const addToResourceList = (data) => {
    let index = resourceTableBody.getElem('.r-item') ? resourceTableBody.getElem('.r-item', true).length + 1 : 1;
    const {id,ISBN,title,author,publisher,category,desc,cost,createdAt,status} = data;
    const resourceRow = `<tr class="r-item ${JSON.parse(status) === 1 ? 'r-item__active' : 'r-item__inactive'}">
        <td>${index}.</td>
        <td>${ISBN}</td>
        <td>${title}</td>
        <td>${author}</td>
        <td>${publisher}</td>
        <td>${category}</td>
        <td>${desc}</td>
        <td>${cost}</td>
        <td>${formatDate(createdAt)}</td>
        <td>
            <div class="m-t-5">
                <span class="status text-cap">${JSON.parse(status) === 1 ? 'active' : 'inactive'}</span>
            </div>
        </td>
        <td>
            <div class="flex flex-wrap align-c justify-c">
                <div style="padding: 2px;">
                    <button title="${JSON.parse(status) === 1 ? 'Disable' : 'Enable'}" class="btn icon stroke text-cap" style="font-size: 12px; padding: 2px 4px;" data-status="${id}" onclick="statusEvent(event);">
                        <svg xmlns="http://www.w3.org/2000/svg" class="disable" width="32" height="32" viewBox="0 0 24 24" stroke-width="1.5" stroke="#2c3e50" fill="none" stroke-linecap="round" stroke-linejoin="round">
                            <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                            <line x1="3" y1="3" x2="21" y2="21" />
                            <path d="M10.584 10.587a2 2 0 0 0 2.828 2.83" />
                            <path d="M9.363 5.365a9.466 9.466 0 0 1 2.637 -.365c4 0 7.333 2.333 10 7c-.778 1.361 -1.612 2.524 -2.503 3.488m-2.14 1.861c-1.631 1.1 -3.415 1.651 -5.357 1.651c-4 0 -7.333 -2.333 -10 -7c1.369 -2.395 2.913 -4.175 4.632 -5.341" />
                        </svg>
                        <svg xmlns="http://www.w3.org/2000/svg" class="enable" width="32" height="32" viewBox="0 0 24 24" stroke-width="1.5" stroke="#2c3e50" fill="none" stroke-linecap="round" stroke-linejoin="round">
                            <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                            <circle cx="12" cy="12" r="2" />
                            <path d="M22 12c-2.667 4.667 -6 7 -10 7s-7.333 -2.333 -10 -7c2.667 -4.667 6 -7 10 -7s7.333 2.333 10 7" />
                        </svg>
                    </button>
                </div>
                <div style="padding: 2px;">
                    <button title="Delete" class="btn text-cap icon stroke" style="font-size: 12px; padding: 2px 4px;" data-del="${id}" onclick="deleteEvent(event);">
                        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" stroke-width="1.5" stroke="#2c3e50" fill="none" stroke-linecap="round" stroke-linejoin="round">
                            <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                            <line x1="4" y1="7" x2="20" y2="7" />
                            <line x1="10" y1="11" x2="10" y2="17" />
                            <line x1="14" y1="11" x2="14" y2="17" />
                            <path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12" />
                            <path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3" />
                        </svg>
                    </button>
                </div>
            </div>
        </td>
    </tr>`;
    resourceTableBody.appendElem(resourceRow);
}
window.statusEvent = (e) => {
    const el = e.currentTarget;
    const ID = el.attr('data-status');
    const parentElem = el.getParent('r-item');
    const isActive = parentElem.classList.contains('r-item__active');
    // impression
    if (isActive) {
        SET.fixClass([parentElem,parentElem],[['r-item__active'],['r-item__inactive']], [false,true]);
        parentElem.getElem('td span.status').html('inactive');
        el.attr('title', 'Enable');
    } else {
        SET.fixClass([parentElem,parentElem],[['r-item__active'],['r-item__inactive']], [true,false]);
        parentElem.getElem('td span.status').html('active');
        el.attr('title', 'Disable');
    }
    SET.ajax({
        method: 'PUT',
        url: `/l/resource/status/${ID}`,
        headers: {
            'Content-Type': false
        },
        handler: (res, err) => {
            if (err)
                return notifier(`${err.code ? err.code+': ' : ''}${err.msg}`,'error');
            const { error, errorMsg, data, force } = res;
            if (force) 
                return redirectFunc(force);
            if (error)
                return notifier(`${errorMsg}`,'error');
            if (data) {
                return;
            }
            notifier('An error occurred processing request.','error');
        },
    })
}
window.deleteEvent = (e) => {
    if (confirm('This action cannot be reversed if you continue.')) {
        const el = e.currentTarget;
        const ID = el.attr('data-del');
        // impression
        SET.removeElem(el.getParent('r-item'));
        SET.ajax({
            method: 'DELETE',
            url: `/l/resource/delete/${ID}`,
            headers: {
                'Content-Type': false
            },
            handler: (res, err) => {
                if (err)
                    return notifier(`${err.code ? err.code+': ' : ''}${err.msg}`,'error');
                const { error, errorMsg, data, force } = res;
                if (force) 
                    return redirectFunc(force);
                if (error)
                    return notifier(`${errorMsg}`,'error');
                if (data) {
                    return;
                }
                notifier('An error occurred processing request.','error');
            },
        });
    }
}
// const activateResourceActions = () => {
//     let statusBtns = resourceTableBody.getElem('button[data-status]', true);
//     let deleteBtns = resourceTableBody.getElem('button[data-del]', true);
//     statusBtns.forEach(e => {
//         e.off('click', statusEvent);
//         e.on('click', statusEvent);
//     });
//     deleteBtns.forEach(e => {
//         e.off('click', deleteEvent);
//         e.on('click', deleteEvent);
//     });
// }
const moreLoad = (start) => {
    const moreBtn = resourceTableBody.getElem('#more');
    moreBtn.on('click', () => {
        SET.removeElem(moreBtn.getParent('r-item'));
        fetchResource(start,null,false);
    })
}
window.on('DOMContentLoaded', () => {
    fetchResource();
});
/**
 * refresh
 */
const refreshBtn = SET.$('#refreshResource');
refreshBtn.on('click', () => {
    SET.fixClass([refreshBtn],[['spin']],[true]);
    refreshBtn.attr('disabled', true);
    fetchResource(null,null,true,() => {
        SET.fixClass([refreshBtn],[['spin']],[false])
        refreshBtn.attr('disabled', false);
    });
});
/**
 * search resource
 */
SET.$('form#searchResource').on('submit', e => {
    e.preventDefault();
    const searchInput = e.currentTarget.getElem('input[name=q]');
    const searchValue = searchInput.value;
    if (searchValue.trim().length > 0) {
        fetchResource(null,null,true,null,`/l/resource/search?q=${searchValue}`);
    }
});