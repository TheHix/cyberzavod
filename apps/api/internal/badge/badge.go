// Package badge draws the gallery SVG badge for a README: "cyberzavod | N builds".
package badge

import (
	"fmt"
	"html"
	"strconv"
	"unicode/utf8"
)

const (
	label = "cyberzavod"
	// privateMessage is what a private or nonexistent gallery's badge shows.
	privateMessage = "private"

	labelColor   = "#555"
	buildsColor  = "#e8590c"
	privateColor = "#9f9f9f"

	height = 20
	// charWidth is the average character width of an 11px font without kerning. The viewer has
	// their own font, so the width is estimated from the character count rather than measured.
	charWidth = 7
	padding   = 6
	textY     = 14
	fontStack = "Verdana,Geneva,DejaVu Sans,sans-serif"
)

// Builds draws the badge of the public gallery of login with count recordings.
func Builds(login string, count int) string {
	message := buildsMessage(count)

	return render(login, message, buildsColor)
}

// Private draws the grey badge of a private or nonexistent gallery: the image in someone's README
// does not break, but it does not reveal whether such an author exists either.
func Private(login string) string {
	return render(login, privateMessage, privateColor)
}

func buildsMessage(count int) string {
	if count == 1 {
		return "1 build"
	}

	return strconv.Itoa(count) + " builds"
}

// render builds the SVG from two halves: a grey label and a coloured message.
func render(login, message, messageColor string) string {
	labelWidth := textWidth(label)
	messageWidth := textWidth(message)
	totalWidth := labelWidth + messageWidth
	title := html.EscapeString(fmt.Sprintf("%s: %s — %s", label, login, message))

	return fmt.Sprintf(`<svg xmlns="http://www.w3.org/2000/svg" width="%[1]d" height="%[2]d" role="img" aria-label="%[3]s">`+
		`<title>%[3]s</title>`+
		`<clipPath id="r"><rect width="%[1]d" height="%[2]d" rx="3" fill="#fff"/></clipPath>`+
		`<g clip-path="url(#r)">`+
		`<rect width="%[4]d" height="%[2]d" fill="%[5]s"/>`+
		`<rect x="%[4]d" width="%[6]d" height="%[2]d" fill="%[7]s"/>`+
		`</g>`+
		`<g fill="#fff" text-anchor="middle" font-family="%[8]s" font-size="11">`+
		`<text x="%[9]d" y="%[10]d">%[11]s</text>`+
		`<text x="%[12]d" y="%[10]d">%[13]s</text>`+
		`</g></svg>`,
		totalWidth, height, title,
		labelWidth, labelColor,
		messageWidth, messageColor,
		fontStack,
		labelWidth/2, textY, html.EscapeString(label),
		labelWidth+messageWidth/2, html.EscapeString(message),
	)
}

// textWidth estimates the width of a label with padding at the edges.
func textWidth(text string) int {
	return utf8.RuneCountInString(text)*charWidth + 2*padding
}
