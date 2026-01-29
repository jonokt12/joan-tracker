{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    systems.url = "github:nix-systems/default";
    flake-utils = {
      url = "github:numtide/flake-utils";
      inputs.systems.follows = "systems";
    };
  };

  outputs =
    {
      self,
      nixpkgs,
      flake-utils,
      ...
    }:
    flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
      in
      {
        packages = {
          default = pkgs.buildNpmPackage {
            pname = "joan-flash";
            version = "1.0.0";

            src = ./.;

            npmDepsHash = "sha256-+GRnNW9FBU5jzc7UB3CotJ0pxNfO5FaPcfuauPJUr8g=";

            # The build phase is not needed, we're just installing dependencies
            dontNpmBuild = true;

            installPhase = ''
              runHook preInstall

              mkdir -p $out/bin $out/lib

              # Copy the application files
              cp -r node_modules $out/lib/
              cp server.js $out/lib/
              cp package.json $out/lib/
              cp index.html $out/lib/

              # Create a wrapper script
              cat > $out/bin/joan-flash <<EOF
              #!${pkgs.bash}/bin/bash
              exec ${pkgs.nodejs}/bin/node $out/lib/server.js "\$@"
              EOF
              chmod +x $out/bin/joan-flash

              runHook postInstall
            '';

            meta = {
              description = "Study time tracking web application";
              license = pkgs.lib.licenses.isc;
            };
          };
        };

        devShells.default = pkgs.mkShell {
          packages = with pkgs; [
            nodejs
            prettier
          ];
        };
      }
    )
    // {
      nixosModules.default =
        { config, lib, pkgs, ... }:
        with lib;
        let
          cfg = config.services.joan-flash;
        in
        {
          options.services.joan-flash = {
            enable = mkEnableOption "joan-flash study time tracker";

            port = mkOption {
              type = types.port;
              default = 3000;
              description = "Port to listen on";
            };

            dataDir = mkOption {
              type = types.path;
              default = "/var/lib/joan-flash";
              description = "Directory for storing data files";
            };

            user = mkOption {
              type = types.str;
              default = "joan-flash";
              description = "User account under which joan-flash runs";
            };

            group = mkOption {
              type = types.str;
              default = "joan-flash";
              description = "Group under which joan-flash runs";
            };
          };

          config = mkIf cfg.enable {
            systemd.services.joan-flash = {
              description = "Joan Flash Study Time Tracker";
              wantedBy = [ "multi-user.target" ];
              after = [ "network.target" ];

              serviceConfig = {
                Type = "simple";
                User = cfg.user;
                Group = cfg.group;
                ExecStart = "${self.packages.${pkgs.system}.default}/bin/joan-flash ${toString cfg.port}";
                Restart = "on-failure";
                RestartSec = "5s";

                # Security hardening
                NoNewPrivileges = true;
                PrivateTmp = true;
                ProtectSystem = "strict";
                ProtectHome = true;
                ReadWritePaths = [ cfg.dataDir ];

                # Environment variables
                Environment = [
                  "DATA_DIR=${cfg.dataDir}"
                  "NODE_ENV=production"
                ];
              };
            };

            # Create user and group
            users.users.${cfg.user} = {
              isSystemUser = true;
              group = cfg.group;
              home = cfg.dataDir;
              createHome = true;
            };

            users.groups.${cfg.group} = { };
          };
        };
    };
}
