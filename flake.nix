{
  description = "A development shell for the n8n-nodes-webuntis project";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
  };

  outputs = { self, nixpkgs }:
    let
      system = "x86_64-linux";
      pkgs = import nixpkgs {
        inherit system;
      };
    in
    {
      devShells.${system}.default = pkgs.mkShell {
        buildInputs = [
          pkgs.nodejs
          pkgs.nodePackages.npm
          pkgs.nodePackages.typescript
          pkgs.nodePackages.gulp
        ];
      };
    };
}
