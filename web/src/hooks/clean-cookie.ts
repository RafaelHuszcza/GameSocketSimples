export const cleanCookie = (name: string) => {
  document.cookie =
    name +
    '=' +
    '0' +
    ';expires=Thu, 01 Jan 1970 00:00:01 GMT' +
    ';path=/' +
    ';domain=localhost'

  // return null
}