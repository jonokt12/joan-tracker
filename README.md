# Joan Flash - Study Time Tracker

A web-based study time tracking application built with Node.js and Express.

## Features

- Track study time across 5 categories: Textbook, Podcast, Notes, Flashcards, Practice
- Running totals table with percentages
- Interactive charts showing:
  - Daily study time by category
  - Running totals over time (cumulative)
- Multiple database support:
  - Create and switch between different databases
  - Delete databases with confirmation
  - Each database is a separate JSON file
- Persistent JSON data storage

## Deployment on NixOS

This application includes a complete NixOS module for easy deployment.

### Using the NixOS Module

Add this to your NixOS configuration:

```nix
{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    joan-flash = {
      url = "github:YOUR_USERNAME/joan-flash";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs = { nixpkgs, joan-flash, ... }: {
    nixosConfigurations.your-hostname = nixpkgs.lib.nixosSystem {
      modules = [
        joan-flash.nixosModules.default
        {
          services.joan-flash = {
            enable = true;
            port = 3000;
            dataDir = "/var/lib/joan-flash";  # Optional, this is the default
          };
        }
      ];
    };
  };
}
```

### Configuration Options

- `services.joan-flash.enable` - Enable the joan-flash service (default: false)
- `services.joan-flash.port` - Port to listen on (default: 3000)
- `services.joan-flash.dataDir` - Directory for storing database files (default: /var/lib/joan-flash)
- `services.joan-flash.user` - User account to run as (default: joan-flash)
- `services.joan-flash.group` - Group to run as (default: joan-flash)

All database files will be stored in `dataDir` as separate JSON files. The default database is `data.json`.

### Exposing via Reverse Proxy

To expose the service via nginx with HTTPS:

```nix
services.nginx = {
  enable = true;
  virtualHosts."study.yourdomain.com" = {
    enableACME = true;
    forceSSL = true;
    locations."/" = {
      proxyPass = "http://localhost:3000";
      proxyWebsockets = true;
    };
  };
};

security.acme = {
  acceptTerms = true;
  defaults.email = "your-email@example.com";
};

networking.firewall.allowedTCPPorts = [ 80 443 ];
```

## Local Development

```bash
# Enter development shell
nix develop

# Install dependencies
npm install

# Run the server
node server.js 3000

# Access at http://localhost:3000
```

## Building with Nix

```bash
# Build the package (first build will ask you to update the hash)
nix build

# If you get a hash mismatch error, update the npmDepsHash in flake.nix with the correct hash from the error message

# Run the built package
./result/bin/joan-flash 3000
```

## Data Storage

Study time data is stored in JSON format. Multiple databases are supported, with each database being a separate JSON file.

The data directory location is configurable via:
- Environment variable: `DATA_DIR`
- NixOS module: `services.joan-flash.dataDir` (defaults to /var/lib/joan-flash)
- Local development: defaults to current working directory

### Managing Databases

- Use the dropdown at the top of the page to switch between databases
- Click "Create New" to create a new database (enter a name using letters, numbers, dashes, and underscores)
- Click "Delete" to remove the currently selected database (requires confirmation and at least one database must remain)

## License

ISC
