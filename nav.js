const header = document.querySelector('header');
const toggle = header.querySelector('.menu-toggle');
const navigation = document.getElementById('primary-menu');
const desktop = matchMedia('(min-width: 960px)');
const groups = [...header.querySelectorAll('.nav-group')].map(element => ({
  element,
  button: element.querySelector('.nav-trigger'),
  panel: element.querySelector('.nav-panel')
}));
const background = [...document.querySelectorAll('main, footer')];
let mobileOpen = false;
let restoreScroll;

function closePanels() {
  for (const { button, panel } of groups) {
    button.setAttribute('aria-expanded', 'false');
    panel.hidden = desktop.matches;
  }
}

function closeMobile(returnFocus = false) {
  mobileOpen = false;
  toggle.setAttribute('aria-expanded', 'false');
  navigation.hidden = !desktop.matches;
  restoreScroll?.();
  restoreScroll = undefined;
  if (returnFocus) toggle.focus();
}

function openMobile() {
  mobileOpen = true;
  toggle.setAttribute('aria-expanded', 'true');
  navigation.hidden = false;
  const previousOverflow = [document.documentElement.style.overflow, document.body.style.overflow];
  const previousInert = background.map(element => element.inert);
  document.documentElement.style.overflow = 'hidden';
  document.body.style.overflow = 'hidden';
  background.forEach(element => { element.inert = true; });
  restoreScroll = () => {
    [document.documentElement.style.overflow, document.body.style.overflow] = previousOverflow;
    background.forEach((element, index) => { element.inert = previousInert[index]; });
  };
}

for (const { element, button, panel } of groups) {
  button.addEventListener('click', () => {
    if (!desktop.matches) return;
    const open = button.getAttribute('aria-expanded') !== 'true';
    closePanels();
    button.setAttribute('aria-expanded', String(open));
    panel.hidden = !open;
  });
  element.addEventListener('focusout', event => {
    if (desktop.matches && !element.contains(event.relatedTarget)) {
      button.setAttribute('aria-expanded', 'false');
      panel.hidden = true;
    }
  });
}

toggle.addEventListener('click', () => {
  if (mobileOpen) closeMobile(true);
  else openMobile();
});
header.addEventListener('click', event => {
  if (!event.target.closest('a')) return;
  closePanels();
  if (mobileOpen) closeMobile(true);
});
document.addEventListener('click', event => {
  if (desktop.matches) {
    for (const { element, button, panel } of groups) {
      if (!element.contains(event.target)) {
        button.setAttribute('aria-expanded', 'false');
        panel.hidden = true;
      }
    }
  } else if (mobileOpen && !header.contains(event.target)) closeMobile(true);
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    if (mobileOpen) {
      event.preventDefault();
      closeMobile(true);
    } else {
      const openGroup = groups.find(({ button }) => button.getAttribute('aria-expanded') === 'true');
      if (openGroup) {
        event.preventDefault();
        closePanels();
        openGroup.button.focus();
      }
    }
  }
  if (event.key === 'Tab' && mobileOpen) {
    const focusable = [...header.querySelectorAll('a[href], button')].filter(element =>
      element.getClientRects().length && !element.disabled);
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
});
desktop.addEventListener('change', () => {
  const focusWillHide = navigation.contains(document.activeElement) && !desktop.matches;
  const mobileToggleFocused = desktop.matches && document.activeElement === toggle;
  closeMobile();
  closePanels();
  if (focusWillHide) toggle.focus();
  else if (mobileToggleFocused) header.querySelector('.btn').focus();
});
header.classList.add('has-menu');
toggle.hidden = false;
closeMobile();
closePanels();
