const { prisma } = require("./generated/prisma-client");
const inquirer = require("inquirer");
// A `main` function so that we can use async/await

async function seed() {
  // Root User
  try {
    const root = await prisma.user({ name: "root" });
    if (!root) {
      await prisma.createUser({ name: "root" });
    }
  } catch (error) {
    throw error;
  }
  //Root Group
  try {
    const root = await prisma.group({ name: "root" });
    if (!root) {
      await prisma.createGroup({ name: "root" });
    }
  } catch (error) {
    throw error;
  }
  try {
    const rootUsers = await prisma.group({ name: "root" }).users();
    if (rootUsers.length == 0) {
      const group = await prisma.group({ name: "root" });
      const root = await prisma.user({ name: "root" });
      await prisma.updateGroup({
        data: {
          users: { set: [{ id: root.id }] }
        },
        where: { id: group.id }
      });
    }
  } catch (error) {
    throw error;
  }
  //Root Dir
  try {
    const dirs = await prisma.inodes();
    const baseDir = dirs.find(f => f.name === "base_dir");
    if (!baseDir) {
      const group = await prisma.group({ name: "root" });
      const root = await prisma.user({ name: "root" });
      const permissions = await prisma.createPermission({
        user: {
          create: {
            read: true,
            write: true,
            execute: true
          }
        },
        group: {
          create: {
            read: true,
            write: true,
            execute: true
          }
        },
        other: {
          create: {
            read: true,
            write: true,
            execute: true
          }
        }
      });
      const metadata = await prisma.createMetadata({
        owner: {
          connect: { id: root.id }
        },
        group: {
          connect: { id: group.id }
        },
        permissions: {
          connect: { id: permissions.id }
        },
        type: "DIRECTORY",
        data: {
          create: [
            {
              data: "Base Dir"
            }
          ]
        }
      });
      const inode = await prisma.createInode({
        name: "base_dir",
        metadata: { connect: { id: metadata.id } }
      });
    }
  } catch (error) {
    throw error;
  }
  return Promise.resolve(true);
}

async function addUser(name) {
  try {
    const user = await prisma.createUser({ name });
    //Check for Everybody
    const groups = await getGroups()
    let everybody = groups.find(f => f.name === 'everybody')
    await addUserToGroup(everybody.id, user.id)
    return Promise.resolve(user);
  } catch (error) {
    throw error;
  }
}
async function getUser(name) {
  try {
    const user = prisma.user({ name });
    return Promise.resolve(user);
  } catch (error) {
    throw error;
  }
}

async function getUsers() {
  try {
    return prisma.users();
  } catch (error) {
    throw error;
  }
}

async function addGroup(name) {
  try {
    const group = await prisma.createGroup({ name });
    const root = await prisma.user({ name: "root" });
    await addUserToGroup(group.id, root.id); //Root belongs to every group
    return Promise.resolve(group);
  } catch (error) {
    throw error;
  }
}
async function getGroup(name) {
  try {
    const group = await prisma.group({ name });
    return Promise.resolve(group);
  } catch (error) {
    throw error;
  }
}

async function getGroups() {
  try {
    return prisma.groups();
  } catch (error) {
    throw error;
  }
}

async function addUserToGroup(gid, uid) {
  try {
    const users = await prisma.group({ id: gid }).users();
    const user = await prisma.user({ id: uid });
    users.push(user);
    await prisma.updateGroup({
      data: {
        users: {
          set: users.map(x => {
            return { id: x.id };
          })
        }
      },
      where: { id: gid }
    });
  } catch (error) {
    throw error;
  }
  return Promise.resolve(true);
}

async function ls(cwd, whoAmI) {
  try {
    const uGroups = await getUserGroups(whoAmI);
    const groupLookups = uGroups.map(x => x.id)
    const children = await prisma.inodes({
      where: {
        metadata: {
          group: {
            id_in: groupLookups
          },
          parent: cwd.id
        }
      }
    });
    return Promise.resolve(children);
  } catch (error) {
    throw error;
  }
}

async function mkdir(cwd, whoAmI, dirName) {
  try {
    const uGroups = await getUserGroups(whoAmI);
    const root = await prisma.user({ name: "root" }); //May or may not implement
    const metadataOwner = await prisma
      .inode({ id: cwd.id })
      .metadata()
      .owner();
    const metadataGroup = await prisma
      .inode({ id: cwd.id })
      .metadata()
      .group();
    const isOwner = metadataOwner.id == whoAmI.id;
    const isInGroup = uGroups.find(f => metadataGroup.id === f.id);
    const group = uGroups[0]; //Grabbing first group
    // TODO Check perms
    if (isOwner || isInGroup) {
      const permissions = await prisma.createPermission({
        user: {
          create: {
            read: true,
            write: true,
            execute: true
          }
        },
        group: {
          create: {
            read: true,
            write: true,
            execute: true
          }
        },
        other: {
          create: {
            read: true,
            write: true,
            execute: true
          }
        }
      });
      const metadata = await prisma.createMetadata({
        owner: {
          connect: { id: whoAmI.id }
        },
        group: {
          connect: { id: group.id }
        },
        permissions: {
          connect: { id: permissions.id }
        },
        type: "DIRECTORY",
        data: {
          create: [
            {
              data: dirName
            }
          ]
        },
        parent: cwd.id
      });
      const inode = await prisma.createInode({
        name: dirName,
        metadata: { connect: { id: metadata.id } }
      });
      return ls(cwd, whoAmI);
    } else {
      console.log("You do not have permission to create a dir here");
    }
  } catch (error) {
    throw error;
  }
  return Promise.resolve(true);
}

async function getUserGroups(whoAmI) {
  return prisma.groups({
    where: {
      users_some: {
        id: whoAmI.id
      }
    }
  });
}

async function chown(dir, uid, gid) {
  try {
    const metadata = await prisma.inode({id: dir}).metadata()
    if(metadata) {
      await prisma.updateMetadata({
        data: {
          owner: {
            connect: { id: uid}
          }, 
          group: {
            connect: { id: gid}
          }
        },
        where: {
          id: metadata.id
        }
      })
    }
  } catch (error) {
    throw error
  }
  return Promise.resolve(true)
}

async function tree(cwd, whoAmI) {
  try {
    
  } catch (error) {
    throw error
  }
  return Promise.resolve(true)
}

async function checkCanCDUp(cwd, whoAmI) {
  try {
    const uGroups = await getUserGroups(whoAmI);
    const root = await prisma.user({ name: "root" }); //May or may not implement

    const hasParent = await prisma
      .inode({ id: cwd.id })
      .metadata()
      .parent();
    if (!hasParent) return Promise.resolve(false);

    const metadataOwner = await prisma
      .inode({ id: hasParent })
      .metadata()
      .owner();
    const metadataGroup = await prisma
      .inode({ id: hasParent })
      .metadata()
      .group();
    const isOwner = metadataOwner.id == whoAmI.id;
    const isInGroup = uGroups.find(f => metadataGroup.id === f.id);

    return Promise.resolve((isOwner || isInGroup) && hasParent);
  } catch (error) {
    throw error;
  }
}

const commandsAvailable = [
  "Quit", // 0
  "Add User", // 1
  "Get User", // 2
  "Get All Users", // 3
  "Add Group", // 4
  "Get Group", // 5
  "Get All Groups", // 6
  "Add User to Group", // 7
  "whoami", // 8
  "su", // 9
  "pwd", // 10
  "ls", // 11
  "mkdir", // 12
  "cd", // 13
  "chown" // 14
];
const commandPrompt = {
  type: "list",
  name: "command",
  message: "What do you want to do?",
  choices: commandsAvailable
};

async function ask(cwd, whoAmI) {
  try {
    const answer = await inquirer.prompt(commandPrompt);
    let resp = "";
    switch (answer.command) {
      case commandsAvailable[0]:
        process.exit(0);
        break;
      case commandsAvailable[1]:
        resp = await inquirer.prompt({
          type: "input",
          name: "name",
          message: "Name for user?"
        });
        resp = await addUser(resp.name);
        console.dir(resp);
        break;
      case commandsAvailable[2]:
        resp = await inquirer.prompt({
          type: "input",
          name: "name",
          message: "Name for user?"
        });
        resp = await getUser(resp.name);
        console.dir(resp);
        break;
      case commandsAvailable[3]:
        resp = await getUsers();
        console.dir(resp);
        break;
      case commandsAvailable[4]:
        resp = await inquirer.prompt({
          type: "input",
          name: "name",
          message: "Name for group?"
        });
        resp = await addGroup(resp.name);
        console.dir(resp);
        break;
      case commandsAvailable[5]:
        resp = await inquirer.prompt({
          type: "input",
          name: "name",
          message: "Name for group?"
        });
        resp = await getGroup(resp.name);
        console.dir(resp);
        break;
      case commandsAvailable[6]:
        resp = await getGroups();
        console.dir(resp);
        break;
      case commandsAvailable[7]:
        {
          const groups = await getGroups();
          const users = await getUsers();
          resp = await inquirer.prompt([
            {
              type: "list",
              name: "group",
              message: "Which group?",
              choices: groups.map(x => `${x.id}:${x.name}`)
            },
            {
              type: "list",
              name: "user",
              message: "Which user?",
              choices: users.map(x => `${x.id}:${x.name}`)
            }
          ]);
          const group = resp.group.split(":")[0];
          const user = resp.user.split(":")[0];
          resp = await addUserToGroup(group, user);
          console.dir(resp);
        }
        break;
      case commandsAvailable[8]:
        console.dir(whoAmI);
        break;
      case commandsAvailable[9]:
        {
          const users = await getUsers();
          resp = await inquirer.prompt([
            {
              type: "list",
              name: "user",
              message: "Which user?",
              choices: users.map(x => `${x.id}:${x.name}`)
            }
          ]);
          const user = resp.user.split(":")[0];
          whoAmI = users.find(f => f.id === user);
        }
        break;
      case commandsAvailable[10]:
        console.dir(cwd);
        break;
      case commandsAvailable[11]:
        resp = await ls(cwd, whoAmI);
        console.dir(resp);
        break;
      case commandsAvailable[12]:
        resp = await inquirer.prompt({
          type: "input",
          name: "name",
          message: "Name for dir?"
        });
        resp = await mkdir(cwd, whoAmI, resp.name);
        console.dir(resp);
        break;
      case commandsAvailable[13]:
        {
          const list = await ls(cwd, whoAmI);
          const canCDUp = await checkCanCDUp(cwd, whoAmI);
          if (canCDUp) {
            list.push({
              id: canCDUp,
              name: ".."
            });
          }
          if (list.length != 0) {
            resp = await inquirer.prompt([
              {
                type: "list",
                name: "dir",
                message: "Which dir?",
                choices: list.map(x => `${x.id}:${x.name}`)
              }
            ]);
            const selDir = resp.dir.split(":")[0];
            cwd = await prisma.inode({ id: selDir });
          } else {
            console.log("You do not have permission to CD from here.");
          }
        }
        resp = await ls(cwd, whoAmI);
        console.dir(resp);
        break;
      case commandsAvailable[14]:
        {
          const list = await ls(cwd, whoAmI)
          if(list.length > 0) {
            const groups = await getGroups()
            const users = await getUsers()
            resp = await inquirer.prompt([
              {
                type: "list",
                name: "dir",
                message: "Which dir?",
                choices: list.map(x => `${x.id}:${x.name}`)
              },
              {
                type: "list",
                name: "user",
                message: "Which user?",
                choices: users.map(x => `${x.id}:${x.name}`)
              },
              {
                type: "list",
                name: "group",
                message: "Which group?",
                choices: groups.map(x => `${x.id}:${x.name}`)
              }
            ]);
            const selDir = resp.dir.split(":")[0];
            const user = resp.user.split(":")[0];
            const group = resp.group.split(":")[0];
            await chown(selDir, user, group)
            resp = await ls(cwd, whoAmI)
            console.dir(resp)
          } else {
            console.log('You have no permissions on child directories.')
          }
        }
        break;
    }
    ask(cwd, whoAmI);
  } catch (error) {
    console.error(error);
    ask(cwd, whoAmI);
  }
}

async function main() {
  // Seed Db
  try {
    const seeded = await seed();
    const dirs = await prisma.inodes();
    const baseDir = dirs.find(f => f.name === "base_dir");
    const root = await prisma.user({ name: "root" });
    //Check for Everybody
    const groups = await getGroups()
    let everybody = groups.find(f => f.name === 'everybody')
    if(!everybody){
      //Create group
      everybody = await addGroup('everybody')
    }
    //Chown base to everybody
    await chown(baseDir.id, root.id, everybody.id)
    //Add all users to everybody
    const users = await getUsers()
    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      await addUserToGroup(everybody.id, user.id)
    }
    ask(baseDir, root);
  } catch (error) {
    console.error(error);
  }
}

main().catch(e => console.error(e));
