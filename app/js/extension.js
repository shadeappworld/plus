if(!!window.chrome?.permissions){
    document.addEventListener("DOMContentLoaded", () => {
        if(window.outerWidth-window.innerWidth > 100) {
            // if side panel
        } else {
            // if popup
            document.body.setAttribute("extension", true);
            dv.force_window = true;
        }
    });
}
