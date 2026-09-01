import { GitHubIcon, GoogleIcon } from '../icons/SocialIcons';

type SocialLoginButtonsProps = {
  layout?: 'stack' | 'row';
};

export default function SocialLoginButtons({ layout = 'stack' }: SocialLoginButtonsProps) {
  return (
    <div className={layout === 'row' ? 'social-row-dark' : 'social-stack'}>
      <button type="button" className="social-btn-dark">
        <GoogleIcon className="social-brand-icon" />
        Continue with Google
      </button>
      <button type="button" className="social-btn-dark">
        <GitHubIcon className="social-brand-icon" />
        Continue with GitHub
      </button>
    </div>
  );
}
