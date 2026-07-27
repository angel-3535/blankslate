export function Prompt({ phrase }: { phrase: string }) {
  const [before = '', after = ''] = phrase.split('___')

  return (
    <h1 className="prompt">
      {before}
      <span className="prompt-blank" aria-label="blank">
        <span />
      </span>
      {after}
    </h1>
  )
}
