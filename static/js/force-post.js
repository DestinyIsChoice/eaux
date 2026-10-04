document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("force-post");
  if (form) {
    form.submit();
  } else {
    console.error("#force-post was not found in the DOM.");
  }
});
