export function realmToString(realm: { catalystName: string } | { serverName: string }) {
  const name = 'catalystName' in realm ? realm.catalystName : realm.serverName

  return name
}
