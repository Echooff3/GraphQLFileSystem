# Creating a *nix like file system using GraphQL
This was just an exercise to see how difficult it would be to mimic a *nix like file system in GraphQL.

## Development
Requires Docker and [Prisma](https://www.prisma.io/docs/get-started/01-setting-up-prisma-new-database-JAVASCRIPT-a002/)

* Clone this repo.
* Run ``` npm install ```
* Start up Prisma (see below)
* Running
  * ``` npm start ```
* Debugging
  * Open in VS Code and use Debug > "Launch Program"
* App runs in CLI use Arrow Keys to make choices.

## Prisma Start up
```bash
docker-compose up -d
prisma init --endpoint http://localhost:4466
prisma deploy
prisma generate
```

## Implemented so far
  * Quit
  * Add User
  * Get User
  * Get All Users
  * Add Group
  * Get Group
  * Get All Groups
  * Add User to Group
  * whoami
  * su
  * pwd
  * ls
  * mkdir
  * cd
  * chown
