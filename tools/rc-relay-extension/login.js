// Clicks through RingCentral sign-in; Chrome fills the saved email and password.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const visible = (el) => el && el.offsetParent !== null;
const button = (re) => [...document.querySelectorAll("button, a, [role=button]")].find((b) => visible(b) && re.test(b.textContent.trim()));

(async () => {
  for (let step = 0; step < 6 && location.hostname === "login.ringcentral.com"; step++) {
    await sleep(3000);
    const resume = button(/^continue as/i);
    if (resume) { resume.click(); continue; }
    const field = [...document.querySelectorAll("input[type=password], input[type=email], input[type=text]")].find(visible);
    if (field) { field.focus(); field.click(); await sleep(1500); }
    button(/^(next|sign in|log in)$/i)?.click();
  }
})();
