const inquiry = 'Hi Torphel, I found your portfolio and would like to discuss a project.';
document.querySelectorAll<HTMLAnchorElement>('[data-whatsapp]').forEach((link) => {
  link.href = `/api/whatsapp?text=${encodeURIComponent(inquiry)}`;
});
