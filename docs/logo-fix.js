const TEAM_LOGOS = {
  "Eisbären Berlin": "assets/teams/berlin.svg",
  "Straubing Tigers": "assets/teams/straubing.svg",
  "Kölner Haie": "assets/teams/koeln.svg",
  "Grizzlys Wolfsburg": "assets/teams/wolfsburg.svg",
  "Nürnberg Ice Tigers": "assets/teams/nuernberg.svg",
  "Augsburger Panther": "assets/teams/augsburg.svg",
  "Krefeld Pinguine": "assets/teams/krefeld.png",
  "Pinguins Bremerhaven": "assets/teams/bremerhaven.svg",
  "Iserlohn Roosters": "assets/teams/iserlohn.svg",
  "ERC Ingolstadt": "assets/teams/ingolstadt.png",
  "EHC Red Bull München": "assets/teams/muenchen.svg",
  "Adler Mannheim": "assets/teams/mannheim.svg",
  "Schwenninger Wild Wings": "assets/teams/schwenningen.svg",
  "Löwen Frankfurt": "assets/teams/frankfurt.svg"
};

function applyTeamLogos() {
  document.querySelectorAll(".team").forEach((teamElement) => {
    const nameElement = teamElement.querySelector(".team-name");
    if (!nameElement) return;

    const teamName = nameElement.textContent.trim();
    const logoPath = TEAM_LOGOS[teamName];
    if (!logoPath) return;

    teamElement.querySelectorAll(".team-logo").forEach((image) => image.remove());

    let image = teamElement.querySelector(".teamLogo");
    if (!image) {
      image = document.createElement("img");
      image.className = "teamLogo";
      image.alt = "";
      image.loading = "lazy";
    }

    image.src = logoPath;

    if (teamElement.classList.contains("home-team")) {
      nameElement.after(image);
    } else {
      nameElement.before(image);
    }
  });
}

const observer = new MutationObserver(applyTeamLogos);
observer.observe(document.body, { childList: true, subtree: true });
applyTeamLogos();
