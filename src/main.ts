import "./styles.css";
import { NumberDial } from "./ui/components/number-dial";
import { FactorDial } from "./ui/components/factor-dial";
import { RrefBoard } from "./ui/components/rref-board";
import { GameHud } from "./ui/components/game-hud";
import { GameStats } from "./ui/components/game-stats";
import { WinOverlay } from "./ui/components/win-overlay";
import { TutorialOverlay } from "./ui/components/tutorial-overlay";
import { GameApp } from "./ui/components/game-app";

// Child components must be defined before <game-app> upgrades so that
// GameApp.connectedCallback finds them fully functional.
customElements.define("number-dial", NumberDial);
customElements.define("factor-dial", FactorDial);
customElements.define("rref-board", RrefBoard);
customElements.define("game-hud", GameHud);
customElements.define("game-stats", GameStats);
customElements.define("win-overlay", WinOverlay);
customElements.define("tutorial-overlay", TutorialOverlay);
customElements.define("game-app", GameApp);
