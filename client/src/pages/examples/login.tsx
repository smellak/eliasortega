import LoginPage from '../login'

export default function LoginPageExample() {
  return <LoginPage onLogin={(email, password) => console.log('Login:', email, password)} />
}
