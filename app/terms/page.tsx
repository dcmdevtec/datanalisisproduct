export default function TermsPage() {
  return (
    <div className="container py-10">
      <h1 className="text-3xl font-bold mb-6">Términos y Condiciones</h1>
      <div className="prose max-w-none">
        <p>Última actualización: {new Date().toLocaleDateString()}</p>

        <h2>1. Introducción</h2>
        <p>
          Bienvenido a SurveyPro. Estos términos y condiciones rigen el uso de nuestra plataforma de encuestas y todos
          los servicios relacionados.
        </p>

        <h2>2. Uso del Servicio</h2>
        <p>
          Al utilizar nuestra plataforma, usted acepta cumplir con estos términos y condiciones. Si no está de acuerdo
          con alguna parte de estos términos, no podrá acceder al servicio.
        </p>

        <h2>3. Privacidad de Datos</h2>
        <p>
          Nos comprometemos a proteger la privacidad de los datos recopilados a través de nuestra plataforma. Para más
          información, consulte nuestra Política de Privacidad.
        </p>

        <h2>4. Cuentas de Usuario</h2>
        <p>
          Al registrarse en nuestra plataforma, usted es responsable de mantener la confidencialidad de su cuenta y
          contraseña. Notifique inmediatamente cualquier uso no autorizado de su cuenta.
        </p>

        <h2>5. Propiedad Intelectual</h2>
        <p>
          Todo el contenido, características y funcionalidad de nuestra plataforma son propiedad de SurveyPro y están
          protegidos por leyes de propiedad intelectual.
        </p>

        <h2>6. Limitación de Responsabilidad</h2>
        <p>
          SurveyPro no será responsable de ningún daño indirecto, incidental, especial, consecuente o punitivo que
          resulte del uso de nuestra plataforma.
        </p>

        <h2>7. Modificaciones</h2>
        <p>
          Nos reservamos el derecho de modificar estos términos en cualquier momento. Las modificaciones entrarán en
          vigor inmediatamente después de su publicación en la plataforma.
        </p>

        <h2>8. Contacto</h2>
        <p>
          Si tiene alguna pregunta sobre estos términos, contáctenos a través de nuestro formulario de contacto o envíe
          un correo electrónico a soporte@surveypro.com.
        </p>
      </div>
    </div>
  )
}
