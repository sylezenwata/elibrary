require("../auth");

require("../../../css/sub/l/home.css");

// scripts
const SET = require("../set");
const { notifier, validateData, redirectFunc, formatDate } = require("../mods");

/**
 * fetch resouces
 */
const resourceCon = SET.$('#resourceContainer');
const resourceLoader = (loadingInfo = 'Loading resources, please wait...') => {
    if (!loadingInfo) {
        return SET.removeElem(resourceCon.getParent().getElem('#resourceLoader'));
    }
    resourceCon.getParent().appendElem(`<div id="resourceLoader" class="m-t-20 p-tb-20 p-lr-10 flex flex-col align-c"><div class="f-14">${loadingInfo}</div></div>`);
}
const fetchResource = (start = null, limit = null, empty = true, cb = null, url = '/l/resource/fetch') => {
    empty && resourceCon.html();
    empty && SET.removeElem(resourceCon.getParent().getElem('#moreResource'))
    resourceLoader();
    let params = [`e=1`];
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
                        resourceCon.html('<div class="r-item__wrap" data-ref="${ISBN}"><div class="f-14 text-c">Resource is not available</div></div>');
                    }
                } else {
                    resource.forEach((eachData) => {
                        addToResourceList(eachData);
                    });
                    if (more) {
                        resourceCon.getParent().appendElem(`<div id="moreResource" class="m-t-20 p-tb-20 p-lr-10 flex flex-col align-c"><button class="btn" style="color: var(--text-color);">More resources</button></div>`);
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
    const {id,title,author,thumbnail} = data;
    let resourceItem = `<div class="r-item__wrap" data-ref="${id}">
        <div class="r-item" onclick="viewResource(event);">
            <div class="r-item__img" style="background-image: url('/assets/uploads/resource/${thumbnail}'); background-size: contain; background-position: top center; background-repeat: no-repeat;"></div>
            <div class="r-item__info f-12 p-10 text-c">
                <h1>${title}</h1>
                <p class="m-t-5">
                    <i class="text-mute">by</i>
                </p>
                <h1 class="m-t-5">${author}</h1>
            </div>
        </div>
    </div>`;
    resourceCon.appendElem(resourceItem);
}
const moreLoad = (start) => {
    const moreBtn = resourceCon.getParent().getElem('#moreResource button');
    moreBtn.on('click', () => {
        SET.removeElem(moreBtn.getParent());
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
/**
 * view a resource
 */
const readModal = SET.$('#readModal');
const readModalTitle = readModal.getElem('#readModalTitle');
const readModalBodyContent = readModal.getElem('.modal-body .modal-body__content');
const closeReadModal = readModal.getElem('#closeReadModal');
const readMode = readModal.getElem('#readMode');
let readModeStatus = JSON.parse(readModal.attr('data-read-mode'));
const handleReadModalDisplay = (disableReaderMode = false) => {
    disableReaderMode && toggleReadMode();
    if (readModal.style.display === 'none' || getComputedStyle(readModal).display === 'none') {
        SET.fixClass(['body'],[['no-overflow']],[true]);
        readModal.style.display = 'block';
        return;
    }
    SET.fixClass(['body'],[['no-overflow']],[false]);
    readModal.style.display = 'none';
    readModalBodyContent.html();
}
const compileResource = (resourceId, cb = null) => {
    if (!(/^([\d]+)$/.test(resourceId))) {
        return notifier('Invalid resource ref, refresh and try again.')
    }
    notifier('Validating resource, please wait...','default',null,'val_resource_noti');
    SET.ajax({
        method: 'GET',
        url: `/l/resource/validate/${resourceId}`,
        timeOut: 60,
        headers: {
            'Content-Type': false
        },
        handler: (res, err) => {
            notifier(null,null,null,'val_resource_noti');
            if (err)
                return notifier(`${err.code ? err.code+': ' : ''}${err.msg}`,'error');
            const { error, errorMsg, data, force } = res;
            if (force) 
                return redirectFunc(force);
            if (error)
                return notifier(`${errorMsg}`,'error');
            if (data) {
                createFrame(data);
                cb && cb();
                return;
            }
            notifier('An error occurred processing request.','error');
        },
    });
}
const createFrame = (resource) => {
    const {id,title,pdf_file} = resource;
    const iframe = `<iframe id="pdf-js-viewer" data-ref="${id}" src="${pdf_file}" title="${title}" frameborder="0"></iframe>`
    readModalTitle.html(title);
    readModalBodyContent.html(iframe);
    handleReadModalDisplay();
}
const toggleReadMode = (notify = false) => {
    readModeStatus = !readModeStatus;
    readModal.attr('data-read-mode', `${readModeStatus}`);
    notify && notifier(`Reading mode ${readModeStatus ? 'activated' : 'deactivated'}.`);
}
window.viewResource = (e) => {
    const resourceId = e.currentTarget.getParent().attr('data-ref');
    compileResource(resourceId, () => {
        readModalBodyContent.getParent('modal-body').scrollTop = 0;
    });
}
closeReadModal.on('click', () => {
    handleReadModalDisplay(readModeStatus ? true : false);
});
readMode.on('click', toggleReadMode);
